# Plan Maestro de Arquitectura, Seguridad y Optimización Avanzada - ASISTEPRO

Este documento detalla una evaluación integral de la arquitectura del proyecto **ASISTEPRO**, identificando oportunidades estratégicas de mejora para llevar el sistema de un estado funcional básico a una plataforma de nivel empresarial, robusta, altamente escalable y segura.

---

## Índice
1. [Evaluación de Arquitectura General](#1-evaluación-de-arquitectura-general)
2. [Vulnerabilidad del QR Estático y Rotación Dinámica (Voz de Alerta)](#2-vulnerabilidad-del-qr-estático-y-rotación-dinámica-voz-de-alerta)
3. [Seguridad Avanzada y Control de Acceso (Multi-Tenant)](#3-seguridad-avanzada-y-control-de-acceso-multi-tenant)
4. [Estructuración y Validación de Datos (Backend y Frontend)](#4-estructuración-y-validación-de-datos-backend-y-frontend)
5. [Rendimiento, Caching y Escalabilidad](#5-rendimiento-caching-y-escalabilidad)
6. [Estrategia de Pruebas y Despliegue Continuo (CI/CD)](#6-estrategia-de-pruebas-y-despliegue-continuo-cicd)

---

## 1. Evaluación de Arquitectura General

El proyecto posee una estructura organizada que sigue buenas prácticas (Separación en Rutas, Controladores, Servicios y Capa de Datos). Sin embargo, al escalar el sistema para soportar cientos de empresas (Tenants) simultáneamente, se presentan las siguientes áreas de oportunidad:

### A. Ausencia de una Capa de Validación Declarativa
*   **Estado Actual:** Las validaciones de datos (ej. [sucursal.service.js](file:///c:/Cursos/asistepro/backend/src/services/sucursal.service.js#L11)) se efectúan de forma imperativa mediante funciones manuales dentro de los servicios.
*   **Problema:** Esto mezcla la lógica de negocio del servicio con las validaciones de tipos de datos, provocando código verboso y difícil de mantener.
*   **Solución:** Mover la validación al nivel de rutas (Express Middleware) utilizando una biblioteca declarativa y liviana como **Zod** o **Joi**. Los servicios recibirán datos limpios y validados.

### B. Registro de Auditoría (Audit Log)
*   **Estado Actual:** No existe un registro centralizado sobre qué usuario modificó registros de empleados, alteró sucursales o editó facturas.
*   **Solución:** Implementar un middleware de auditoría e introducir una tabla `logs_auditoria` para cumplir con las normativas corporativas de trazabilidad.

---

## 2. Vulnerabilidad del QR Estático y Rotación Dinámica (Voz de Alerta)

> [!WARNING]
> **Vulnerabilidad de Suplantación de Asistencia (Spoofing)**
> Actualmente, las sucursales tienen un `qr_token` estático que se almacena en la base de datos y se muestra al empleado ([SucursalQR.jsx](file:///c:/Cursos/asistepro/frontend/src/pages/sucursales/SucursalQR.jsx)).
> 
> Si un empleado toma una fotografía del código QR (o extrae el `qr_token` del payload), puede guardarla e imprimirla o enviarla a sus compañeros. Usando aplicaciones móviles para simular ubicaciones GPS (Fake GPS) y escaneando la imagen del QR desde su hogar, los empleados podrían registrar asistencia sin estar presentes físicamente.

### Cómo solucionarlo: Rotación Dinámica del QR

Para sistemas con pantallas táctiles, monitores o tablets en la entrada de las sucursales, se debe implementar una **Rotación de Tokens Basada en Tiempo (TOTP / Token Expiration)**.

#### Paso 1: Modificar la Base de Datos para soportar Expiración de Tokens
Crear una tabla para registrar los tokens dinámicos emitidos para cada sucursal:

```sql
CREATE TABLE IF NOT EXISTS sucursal_tokens_dinamicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_en TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_tokens_dinamicos_sucursal ON sucursal_tokens_dinamicos(sucursal_id, expira_en);
```

#### Paso 2: Endpoint para Generar y Rotar el Token (SSE / WebSockets / HTTP Polling)
El monitor/tablet de la sucursal consulta un token que expira en 30 segundos:

```javascript
// backend/src/services/sucursal.service.js
const crypto = require('crypto');

async function generateDynamicToken(empresaId, sucursalId) {
  const sucursal = await findSucursalById(empresaId, sucursalId);
  if (!sucursal) throw new Error('Sucursal no encontrada');

  const token = crypto.randomBytes(32).toString('hex');
  const expiraEn = new Date(Date.now() + 30 * 1000); // 30 segundos de vigencia

  await pool.query(
    `INSERT INTO sucursal_tokens_dinamicos (sucursal_id, token, expira_en) VALUES ($1, $2, $3)`,
    [sucursalId, token, expiraEn]
  );

  return { token, expira_en: expiraEn };
}
```

#### Paso 3: Validar el Token Dinámico al Marcar Asistencia
En [marcacion.service.js](file:///c:/Cursos/asistepro/backend/src/services/marcacion.service.js), en lugar de validar contra el `qr_token` estático de la sucursal, validar la vigencia del token dinámico:

```javascript
async function validarTokenDinamico(sucursalId, tokenEnviado) {
  const result = await pool.query(
    `
      SELECT id 
      FROM sucursal_tokens_dinamicos 
      WHERE sucursal_id = $1 
        AND token = $2 
        AND expira_en > NOW()
      LIMIT 1
    `,
    [sucursalId, tokenEnviado]
  );
  return result.rows.length > 0;
}
```

---

## 3. Seguridad Avanzada y Control de Acceso (Multi-Tenant)

### A. Modificar la Estrategia de Tokens (Cookies HTTP-Only)
Actualmente, el `accessToken` y el `refreshToken` se exponen en `localStorage`, lo que los expone ante posibles vulnerabilidades XSS.

*   **Implementación en Backend:**
    Al iniciar sesión, envía el `refreshToken` a través de una cookie no accesible por JavaScript.

```javascript
// backend/src/controllers/auth.controller.js
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const { user, tokens } = await authService.login({ email, password });

    // Enviar el refresh token en una cookie segura y HTTP-Only
    res.cookie('asistepro_refresh', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    });

    return res.json({
      ok: true,
      data: {
        user,
        accessToken: tokens.accessToken, // Se puede mantener en memoria del cliente
      },
    });
  } catch (error) {
    return next(error);
  }
}
```

### B. Evitar Fugas de Información en Logs y Errores
El middleware de errores en [error.middleware.js](file:///c:/Cursos/asistepro/backend/src/middlewares/error.middleware.js) debe estar adaptado para no exponer trazas de error (*stack traces*) de la base de datos PostgreSQL al cliente en entornos de producción:

```javascript
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  console.error(`[Error API]: ${err.message}`, !isProduction ? err.stack : '');

  res.status(statusCode).json({
    ok: false,
    message: statusCode === 500 && isProduction 
      ? 'Ocurrió un error interno en el servidor' 
      : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}
```

---

## 4. Estructuración y Validación de Datos (Backend y Frontend)

### A. Middlewares de Validación con Zod
Implementar validaciones robustas y centralizadas antes de que lleguen a los controladores.

```javascript
// backend/src/middlewares/validation.middleware.js
const validateSchema = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    return next();
  } catch (error) {
    return res.status(400).json({
      ok: false,
      message: 'Error de validación de datos',
      errors: error.errors.map(e => ({ campo: e.path.join('.'), mensaje: e.message })),
    });
  }
};
```

### B. Gestión de Estado Global Limpio en Frontend
A medida que crezcan los módulos (Sucursales, Empleados, Horarios), la recarga constante y el manejo de múltiples estados locales a través de `useResource` puede provocar problemas de sincronización de UI.
*   **Mejora:** Introducir una biblioteca liviana de estado global como **Zustand** para manejar la UI de manera centralizada.
*   **Ventaja:** Permite cachear estados en memoria del lado del cliente, evitando llamadas HTTP duplicadas al navegar entre pestañas del Dashboard.

---

## 5. Rendimiento, Caching y Escalabilidad

### A. Caching de Parámetros Operativos con Redis
Las sucursales, coordenadas de geocercas y horarios de empleados son datos que se consultan en cada marcación, pero cambian con muy poca frecuencia.
*   **Mejora:** Introducir una capa de caché con Redis para evitar consultar PostgreSQL en cada marcación:
    1.  Al marcar asistencia, verificar si los detalles de la sucursal y el horario del empleado están en la caché de Redis.
    2.  Si no están, consultar PostgreSQL y guardarlos en Redis con un tiempo de expiración (TTL) de 1 hora.
    3.  Al actualizar una sucursal u horario mediante el panel administrativo, invalidar la clave de caché correspondiente.

```javascript
// Ejemplo conceptual de Caching en Redis
async function getCachedSucursal(empresaId, sucursalId) {
  const cacheKey = `tenant:${empresaId}:sucursal:${sucursalId}`;
  const cachedData = await redis.get(cacheKey);

  if (cachedData) return JSON.parse(cachedData);

  const dbData = await db.query('SELECT * FROM sucursales WHERE id = $1', [sucursalId]);
  if (dbData.rows[0]) {
    await redis.set(cacheKey, JSON.stringify(dbData.rows[0]), 'EX', 3600); // 1 hora
  }
  return dbData.rows[0];
}
```

### B. Exportación de Reportes Optimizada (Streaming)
El servicio [reporte.service.js](file:///c:/Cursos/asistepro/backend/src/services/reporte.service.js) genera archivos de texto CSV y los almacena en memoria antes de enviarlos. Si un administrador solicita un reporte anual de 500 empleados, la API podría experimentar picos de consumo de memoria RAM y bloquear transiciones concurrentes.
*   **Mejora:** Utilizar Streams de Node.js (`stream.PassThrough` o librerías de escritura progresiva) para escribir los datos directamente en el flujo de respuesta (`res`) a medida que las filas se leen de la base de datos (con cursores como `pg-query-stream`).

---

## 6. Estrategia de Pruebas y Despliegue Continuo (CI/CD)

### A. Pirámide de Pruebas Necesaria
1.  **Pruebas Unitarias (Backend):** Utilizar **Jest** para validar la lógica matemática de cálculo de distancia Haversine en [geo.util.js](file:///c:/Cursos/asistepro/backend/src/utils/geo.util.js) y las reglas de asistencia (dentro/fuera de geocerca, novedades).
2.  **Pruebas de Integración (API):** Probar los endpoints críticos usando `supertest` para simular llamadas al backend con una base de datos de pruebas aislada.
3.  **Pruebas de Extremo a Extremo (E2E):** Implementar **Playwright** para simular de forma automatizada que el empleado puede iniciar sesión, simular la obtención del GPS y marcar correctamente en la interfaz del navegador.

### B. Pipeline de Despliegue en GitHub Actions
Configurar un flujo de trabajo automático que se dispare en cada *Pull Request* o fusión a la rama `main`:
1.  Ejecutar el linter y formateador (`npm run lint` / `prettier`).
2.  Levantar una base de datos PostgreSQL de prueba temporal e instalar el esquema de migraciones (`npm run migrate`).
3.  Ejecutar todas las pruebas unitarias y de integración del backend y frontend.
4.  Generar el build de producción del frontend (`npm run build` en Vite) para validar la ausencia de errores de empaquetado.
5.  Desplegar el Backend en Render/AWS App Runner y el Frontend en Vercel/Netlify si todas las pruebas pasan.
