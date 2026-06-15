# Deploy con Supabase, Render y Vercel

Arquitectura recomendada:

- Supabase: PostgreSQL.
- Render: API Express en `/api`.
- Vercel: frontend React/Vite.

## 1. Supabase

1. Crea un proyecto en Supabase.
2. En `Project Settings > Database`, copia la connection string PostgreSQL.
3. Usa preferiblemente el pooler/transaction connection string para Render.
4. Guarda esa cadena como `DATABASE_URL` en Render.

## 2. Render API

Crear un Web Service desde GitHub usando la raiz del repo.

Render puede leer `render.yaml`, pero si configuras manualmente:

```text
Build Command: npm ci
Start Command: npm run start
Health Check Path: /api/health
```

Variables requeridas:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
DB_SSL=true
JWT_ACCESS_SECRET=coloca_un_secreto_largo
JWT_REFRESH_SECRET=coloca_otro_secreto_largo
CORS_ORIGIN=https://TU_FRONTEND.vercel.app
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
RATE_LIMIT_MAX=1000
```

Despues del primer deploy ejecuta migraciones desde Render Shell:

```bash
npm run migrate
```

Valida:

```text
https://TU_BACKEND.onrender.com/api/health
```

## 3. Vercel Frontend

Importa el proyecto desde GitHub y selecciona:

```text
Root Directory: frontend
Framework: Vite
Build Command: npm run build
Output Directory: dist
```

Variable requerida en Vercel:

```env
VITE_API_URL=https://TU_BACKEND.onrender.com/api
```

Despues de crear el dominio de Vercel, vuelve a Render y actualiza:

```env
CORS_ORIGIN=https://TU_FRONTEND.vercel.app
```

## 4. Checklist de validacion

1. Abrir `/api/health` del backend Render.
2. Abrir el frontend Vercel.
3. Iniciar sesion.
4. Validar que no haya errores CORS en consola.
5. Probar perfil/cambio de contrasena.
6. Probar empresas, empleados, horarios y marcaciones.
7. Probar GPS/camara desde celular con HTTPS.

## Notas

- El frontend no debe usar `/api` en Vercel, porque el backend vive en Render.
- Para cookies cross-site entre Vercel y Render se requiere `COOKIE_SAME_SITE=none` y `COOKIE_SECURE=true`.
- Si cambias el dominio final, actualiza `CORS_ORIGIN` en Render y `VITE_API_URL` en Vercel.
