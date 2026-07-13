# Deploy de ASISTEPRO en Railway

Este repo queda preparado para desplegarse como un solo servicio web en Railway:

- Railway instala dependencias de la raiz con `npm ci`.
- El build ejecuta `npm run build`, instala dependencias del frontend y genera `frontend/dist`.
- El start ejecuta migraciones pendientes y luego levanta Express.
- Express sirve la API en `/api` y el frontend React desde `frontend/dist`.
- El health check de Railway apunta a `/api/health/ready`.

## 1. Crear el proyecto

1. Sube el repo a GitHub.
2. En Railway, crea un nuevo proyecto desde ese repo.
3. Agrega un servicio PostgreSQL de Railway o configura un PostgreSQL externo.
4. En el servicio web, confirma que Railway detecte `railway.json`.

## 2. Variables requeridas

Usa `.env.railway.example` como base.

Variables minimas:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=coloca_un_secreto_largo
JWT_REFRESH_SECRET=coloca_otro_secreto_largo
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
RATE_LIMIT_MAX=1000
AUTH_LOGIN_RATE_LIMIT_MAX=10
AUTH_REGISTER_RATE_LIMIT_MAX=5
SLOW_REQUEST_MS=1500
CRON_SECRET=coloca_un_secreto_largo
```

Si usas Railway PostgreSQL dentro del mismo proyecto, normalmente no actives `DB_SSL`.
Si usas Supabase u otro PostgreSQL externo que exige TLS, agrega:

```env
DB_SSL=true
```

## 3. Frontend

Para el despliegue de un solo servicio, no definas `VITE_API_URL`: el frontend usa `/api` y queda en el mismo dominio del backend.

Si decides separar frontend y backend en dos servicios, define durante el build del frontend:

```env
VITE_API_URL=https://TU_BACKEND.railway.app/api
CORS_ORIGIN=https://TU_FRONTEND.railway.app
FRONTEND_URL=https://TU_FRONTEND.railway.app
COOKIE_SAME_SITE=none
```

## 4. Comandos Railway

`railway.json` ya define:

```text
Build Command: npm ci && npm run build
Start Command: npm run start
Health Check Path: /api/health/ready
```

El comando `npm run start` ejecuta migraciones automaticamente antes de iniciar la API.

## 5. Storage de archivos

Para produccion, configura `STORAGE_DRIVER=supabase` o `STORAGE_DRIVER=s3` y evita guardar PDFs/comprobantes en la base de datos. El driver `database` queda como fallback para pruebas o bajo volumen.

## 6. Validacion despues del deploy

1. Abrir `https://TU_DOMINIO.railway.app/api/health`.
2. Confirmar `environment: production`.
3. Abrir `https://TU_DOMINIO.railway.app/api/health/ready`.
4. Confirmar `database: ready`.
5. Abrir el dominio principal y validar que cargue el login.
6. Iniciar sesion y probar empresas, empleados, horarios, marcaciones y reportes.
7. Desde celular, probar GPS/camara con HTTPS.

## 7. Cron de suscripciones

En produccion el chequeo en proceso queda desactivado por defecto. Para ejecutarlo como tarea separada, crea un cron/job en Railway con:

```text
npm run check-expirations
```

Si prefieres ejecutarlo dentro del web service, define:

```env
ENABLE_IN_PROCESS_CRON=true
```
