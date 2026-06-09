# Auditoría del Proyecto ASISTEPRO SaaS: Mejoras, Redundancias y Optimización

Este documento contiene un análisis detallado del codebase del proyecto local **ASISTEPRO** (SaaS Multi-Tenant para control de asistencia laboral mediante QR + GPS). A continuación, se detallan los elementos redundantes, los puntos de mejora y seguridad, y las optimizaciones de rendimiento y escalabilidad, junto con el código sugerido para implementarlos sin romper la lógica existente.

---

## 1. Lógicas o Elementos Redundantes

### A. Vista y Ruta Duplicada de Pagos en Frontend
*   **Archivo redundante:** [FacturacionPagos.jsx](file:///c:/Cursos/asistepro/frontend/src/pages/facturacion/FacturacionPagos.jsx)
*   **Problema:** Este archivo contiene solo un componente envoltorio (*wrapper*) de 5 líneas que retorna el componente `Facturas` pasándole la prop `defaultTab="pagos"`. En [routes.js](file:///c:/Cursos/asistepro/frontend/src/config/routes.js) hay dos rutas independientes definidas para el rol de `ADMIN_EMPRESA`: `/facturacion` y `/facturacion/pagos`.
*   **Redundancia:** Dado que el propio componente `Facturas` ya gestiona las pestañas internas de facturas y pagos mediante el estado `activeTab`, la existencia de este archivo y de la ruta `/facturacion/pagos` agrega complejidad innecesaria.
*   **Solución:** Eliminar la ruta `/facturacion/pagos` de la configuración de rutas y el archivo `FacturacionPagos.jsx`. Si se desea abrir directamente la pestaña de pagos desde otra sección, se puede pasar un parámetro en la URL mediante *Query Parameters* en la ruta principal (ej. `/facturacion?tab=pagos`) y leerlo en el `useEffect` de `Facturas.jsx` con `useSearchParams`.

### B. Duplicación del Parseo de Paginación en los Controladores
*   **Archivos duplicados:**
    *   [empleado.controller.js](file:///c:/Cursos/asistepro/backend/src/controllers/empleado.controller.js#L3-L8)
    *   [facturacion.controller.js](file:///c:/Cursos/asistepro/backend/src/controllers/facturacion.controller.js#L3-L8)
    *   (Y otros controladores que implementen listados paginados).
*   **Problema:** La función `parsePagination(query)` se encuentra repetida de forma idéntica en múltiples archivos de controladores de la API.
*   **Solución:** Extraer esta función a un archivo de utilidad común en el backend, por ejemplo en un archivo `backend/src/utils/pagination.util.js` o implementarla como un middleware que pre-rellene `req.pagination` para las rutas con listados.

### C. Ejecución Repetitiva y Completa de Scripts SQL de Migración
*   **Archivo:** [migrate.js](file:///c:/Cursos/asistepro/backend/src/database/migrate.js)
*   **Problema:** El array `migrations` en `migrate.js` almacena los nombres de todos los archivos SQL y los ejecuta recursivamente uno por uno cada vez que se corre `npm run migrate`. Aunque muchos de los SQL usan `CREATE TABLE IF NOT EXISTS` u `ON CONFLICT`, hay alteraciones críticas (como `DROP CONSTRAINT` y `ADD CONSTRAINT` en la tabla `pagos` en `012_pagos_aprobacion.sql`) que se ejecutan innecesariamente cada vez.
*   **Riesgo:** En una base de datos de producción con millones de registros, ejecutar comandos DDL como modificar restricciones (`constraints`) bloquea las escrituras en las tablas y recalcula las restricciones sobre todos los registros existentes, lo que degrada el rendimiento e introduce latencias.

---

## 2. Puntos de Mejora (Qué mejorar y Cómo hacerlo)

### A. Control e Historial de Migraciones en la Base de Datos
*   **Qué mejorar:** La infraestructura de base de datos necesita un mecanismo para saber qué scripts de migración ya se han ejecutado y cuáles son nuevos.
*   **Cómo hacerlo:** Modificar el script `migrate.js` para crear una tabla interna llamada `schema_migrations` al iniciar y registrar cada script SQL ejecutado con éxito. En ejecuciones posteriores, solo se aplicarán los archivos `.sql` nuevos.

**Código propuesto para [migrate.js](file:///c:/Cursos/asistepro/backend/src/database/migrate.js):**

```javascript
require('dotenv').config({ path: 'backend/.env' });

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const migrations = [
  '001_schema.sql',
  '002_seed_planes.sql',
  '003_seed_super_admin.sql',
  '004_auth.sql',
  '005_multi_tenant.sql',
  '006_billing.sql',
  '007_sucursales.sql',
  '008_empleados.sql',
  '009_horarios.sql',
  '010_marcaciones.sql',
  '011_facturacion_estado_pagos.sql',
  '012_pagos_aprobacion.sql',
  '013_pagos_comprobantes.sql',
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Crear tabla de control de versiones si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        ejecutado_en TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Consultar qué migraciones ya fueron aplicadas
    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const appliedVersions = new Set(rows.map(r => r.version));

    // 3. Ejecutar solo las pendientes
    for (const migration of migrations) {
      if (appliedVersions.has(migration)) {
        console.log(`Skipping applied migration: ${migration}`);
        continue;
      }

      const filePath = path.join(__dirname, migration);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`Running pending migration: ${migration}`);
      await client.query(sql);

      // Registrar la migración como aplicada
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migration]);
    }

    await client.query('COMMIT');
    console.log('Database migrations completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
```

### B. Migración de `bcrypt` a `bcryptjs`
*   **Qué mejorar:** El uso de `bcrypt` nativo en Windows requiere herramientas de compilación de C++ instaladas localmente (Visual Studio Build Tools / node-gyp). Esto dificulta que otros desarrolladores configuren el entorno de desarrollo local rápido.
*   **Cómo hacerlo:** Desinstalar `bcrypt` e instalar `bcryptjs` en `package.json` (raíz). En el código de [auth.service.js](file:///c:/Cursos/asistepro/backend/src/services/auth.service.js) y [empleado.service.js](file:///c:/Cursos/asistepro/backend/src/services/empleado.service.js), cambiar la importación a `require('bcryptjs')`. Los métodos `compare` y `hash` funcionan exactamente igual.

### C. Detección Dinámica del Archivo `.env` en Migraciones
*   **Qué mejorar:** La línea `require('dotenv').config({ path: 'backend/.env' });` en `migrate.js` y `server.js` asume que el comando siempre se corre desde el directorio raíz. Si el desarrollador entra a la carpeta `backend/` y ejecuta el código, la conexión fallará.
*   **Cómo hacerlo:** Utilizar `path.resolve` para encontrar el archivo de variables de entorno de forma relativa al archivo actual:
```javascript
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
```

### D. Margen de Tolerancia en Geolocalización (GPS)
*   **Qué mejorar:** En [marcacion.service.js](file:///c:/Cursos/asistepro/backend/src/services/marcacion.service.js#L177), la validación de geocerca verifica estrictamente `distancia <= sucursal.radio_metros`. En situaciones reales, la precisión del GPS de los móviles puede variar de 5 a 15 metros debido a interferencias, paredes u obstrucciones, lo que provocaría rechazos incorrectos de asistencia.
*   **Cómo hacerlo:** Agregar un margen de tolerancia (ej. 10 a 15 metros extra) o tomar en cuenta la precisión reportada por el dispositivo móvil (`payload.precision_gps`), limitándola a un máximo aceptable (ej. 20 metros).
```javascript
// Añadir un margen de tolerancia fijo de 10 metros para compensar la imprecisión del GPS del móvil
const dentroGeocerca = distancia <= (Number(sucursal.radio_metros) + 10);
```

### E. Almacenamiento Seguro de Tokens en Cookies HTTP-Only
*   **Qué mejorar:** Actualmente el frontend almacena el `accessToken` y el `refreshToken` en `localStorage` ([auth.js](file:///c:/Cursos/asistepro/frontend/src/utils/auth.js#L6-L12)). Si la aplicación es vulnerable a XSS (Cross-Site Scripting), cualquier script de terceros o dependencia maliciosa podría leer el token.
*   **Cómo hacerlo:**
    1.  Modificar la API de login en el backend para retornar el `refreshToken` en una Cookie con banderas de seguridad: `httpOnly`, `secure`, `sameSite: 'lax'`.
    2.  Modificar el endpoint `/auth/refresh` para leer el token directamente de las cookies enviadas automáticamente por el navegador en lugar del cuerpo del JSON.

---

## 3. Optimización del Rendimiento

### A. Configuración de Límites en el Pool de Base de Datos
*   **Qué optimizar:** En [database.js](file:///c:/Cursos/asistepro/backend/src/config/database.js), el objeto `Pool` de `pg` se inicializa con valores por defecto. Si el volumen de usuarios crece y muchos empleados marcan asistencia a la misma hora, la base de datos podría agotar sus conexiones o sobrecargar el servidor sin liberar conexiones inactivas.
*   **Cómo hacerlo:** Definir parámetros explícitos de rendimiento para el Pool.

```javascript
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'asistepro',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  // Optimizaciones de Pool
  max: Number(process.env.DB_POOL_MAX || 20), // Máximo de conexiones simultáneas
  idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT || 30000), // Cerrar conexiones inactivas tras 30s
  connectionTimeoutMillis: Number(process.env.DB_POOL_CONN_TIMEOUT || 2000), // Timeout de espera por conexión (2s)
});
```

### B. Validar Peso Binario de Comprobantes (BYTEA) antes de decodificar
*   **Qué optimizar:** El backend permite subir archivos binarios (comprobantes de pago) decodificándolos desde strings en Base64 ([facturacion.service.js](file:///c:/Cursos/asistepro/backend/src/services/facturacion.service.js#L72)). La decodificación en memoria bloquea el hilo principal de ejecución (*Event Loop*) si se envían archivos extremadamente grandes.
*   **Cómo hacerlo:** Validar el tamaño del archivo a nivel del controlador o middleware utilizando el tamaño de la cadena Base64 antes de invocar la decodificación completa `Buffer.from(base64, 'base64')`:
```javascript
// La longitud aproximada en bytes de un archivo base64 es (largo * 3) / 4.
const estimatedBytes = (payload.comprobante.data_base64.length * 3) / 4;
if (estimatedBytes > COMPROBANTE_MAX_BYTES) {
  const error = new Error('El comprobante supera el límite de 2MB');
  error.statusCode = 400;
  throw error;
}
```

### C. Crear Índices Compuestos en la Base de Datos para Consultas Frecuentes
*   **Qué optimizar:** La tabla de marcaciones recibe un volumen de datos alto. Las consultas habituales buscan registros por `empresa_id`, `empleado_id` y fecha (`marcado_en`) para generar listados e informes.
*   **Cómo hacerlo:** Agregar un índice compuesto en la base de datos. Crear un archivo `014_indexes_optimization.sql` con la siguiente estructura:

```sql
BEGIN;

CREATE INDEX IF NOT EXISTS idx_marcaciones_reportes
ON marcaciones(empresa_id, empleado_id, marcado_en DESC);

CREATE INDEX IF NOT EXISTS idx_pagos_factura_estado
ON pagos(factura_id, estado);

COMMIT;
```

### D. Carga bajo demanda (*Lazy Loading*) en el Router del Frontend
*   **Qué optimizar:** Actualmente [AppRoutes.jsx](file:///c:/Cursos/asistepro/frontend/src/routes/AppRoutes.jsx) importa todos los componentes de páginas al inicio de la carga de la aplicación. Esto incrementa considerablemente el tamaño del archivo JavaScript inicial (*bundle*) que el navegador del usuario debe descargar y procesar.
*   **Cómo hacerlo:** Implementar importaciones dinámicas utilizando `React.lazy` y `Suspense` para dividir el código y cargar cada página bajo demanda.

**Ejemplo en [AppRoutes.jsx](file:///c:/Cursos/asistepro/frontend/src/routes/AppRoutes.jsx):**

```javascript
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { privateRoutes } from '../config/routes';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute from './ProtectedRoute';

// Páginas cargadas de forma síncrona
import Login from '../pages/auth/Login';

// Componente de carga
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
  </div>
);

export default function AppRoutes({ auth }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={auth.isAuthenticated ? '/dashboard' : '/login'} replace />} />
      <Route
        path="/login"
        element={
          auth.isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <AuthLayout>
              <Login />
            </AuthLayout>
          )
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute auth={auth}>
            <DashboardLayout user={auth.user}>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {privateRoutes.map((route) => {
                    const Page = route.element;
                    return (
                      <Route
                        key={route.path}
                        path={route.path}
                        element={
                          <ProtectedRoute auth={auth} allowedRoles={route.roles}>
                            <Page />
                          </ProtectedRoute>
                        }
                      />
                    );
                  })}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Suspense>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
```

---

## 4. Resumen de Recomendaciones

1.  **Redundancias:** Elimina `FacturacionPagos.jsx` y gestiona las sub-pestañas mediante Query Parameters en `/facturacion`. Modulariza la paginación en controladores.
2.  **Infraestructura SQL:** Evita re-correr todos los DDL en `migrate.js`. Implementa la tabla `schema_migrations` propuesta para control de versiones de base de datos.
3.  **Seguridad y Conectividad:** Migra a `bcryptjs` en la API para facilitar setups en Windows. Adiciona un margen de 10 metros en la distancia GPS para evitar rechazos falsos por imprecisión del dispositivo del empleado.
4.  **Rendimiento:** Configura límites explícitos para el Pool de PostgreSQL (`max: 20`, `idleTimeout`) y añade índices compuestos para reportes. Aplica Lazy Loading en el enrutamiento de React.
