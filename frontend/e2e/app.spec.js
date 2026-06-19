import { expect, test } from '@playwright/test';

const empresaId = '11111111-1111-4111-8111-111111111111';
const facturaId = '22222222-2222-4222-8222-222222222222';

function userFor(role, modulos = {}, permisos = {}) {
  return {
    id: `user-${role.toLowerCase()}`,
    empresa_id: role === 'SUPER_ADMIN' ? null : empresaId,
    empresa: role === 'SUPER_ADMIN' ? null : 'Tenant QA',
    nombres: 'Usuario',
    apellidos: role,
    email: `${role.toLowerCase()}@qa.local`,
    rol: role,
    modulos,
    permisos,
  };
}

async function mockApi(page, user, onRequest = () => {}) {
  await page.addInitScript(({ storedUser, tenantId }) => {
    localStorage.setItem('asistepro_user', JSON.stringify(storedUser));
    localStorage.setItem('asistepro_csrf_token', 'csrf-e2e');
    localStorage.setItem('asistepro_session_expires_at', String(Date.now() + 3_600_000));
    if (tenantId) localStorage.setItem('asistepro_empresa_id', tenantId);
  }, { storedUser: user, tenantId: user.empresa_id });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    onRequest(request, url);

    if (url.pathname.endsWith('/auth/refresh')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            user,
            session: { csrfToken: 'csrf-e2e', expiresInMs: 3_600_000 },
            tokens: { accessToken: 'access-e2e' },
          },
        }),
      });
    }

    if (url.pathname.endsWith(`/facturacion/facturas/${facturaId}`)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: facturaId,
            numero: 'FAC-E2E-001',
            empresa_nombre: 'Tenant QA',
            concepto: 'Suscripcion Growth',
            subtotal: 49,
            impuesto: 0,
            total: 49,
            total_pagado: 0,
            estado: 'pendiente',
          },
        }),
      });
    }

    if (url.pathname.endsWith('/facturacion/pagos/manual')) {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { pago: { estado: 'pendiente' } } }),
      });
    }

    if (url.pathname.endsWith('/laboral/cierres')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) });
    }

    if (url.pathname.endsWith('/organizacion/summary')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            empleados_activos: 12,
            empleados_con_usuario: 8,
            importaciones_mes: 2,
            errores_mes: 1,
            storage: { driver: 'database' },
          },
        }),
      });
    }

    if (url.pathname.endsWith('/organizacion/catalogos')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            estructuras: [],
            sucursales: [{ id: 's1', codigo: 'MAT', nombre: 'Matriz' }],
            supervisores: [{ id: 'e1', codigo: 'EMP-001', nombres: 'Lina', apellidos: 'QA' }],
          },
        }),
      });
    }

    if (url.pathname.endsWith('/organizacion/estructuras')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: [{ id: 'org-1', tipo: 'departamento', codigo: 'RRHH', nombre: 'Recursos Humanos' }],
        }),
      });
    }

    if (url.pathname.endsWith('/organizacion/importaciones')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: [{ id: 'imp-1', nombre_archivo: 'empleados.xlsx', estado: 'procesada', filas_creadas: 4, filas_actualizadas: 2, filas_con_error: 0, resumen: {} }],
        }),
      });
    }

    if (url.pathname.endsWith('/saas/overview')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            resumen: { empresas_activas: 2, mrr: 98, saldo_pendiente: 49, facturas_vencidas: 1 },
            planes: [{ codigo: 'growth', nombre: 'Growth', total: 2 }],
            riesgos: { con_limite_critico: 1, con_cobro_pendiente: 1, con_baja_actividad: 0 },
          },
        }),
      });
    }

    if (url.pathname.endsWith('/saas/tenants')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: [{
            id: 'tenant-1',
            nombre: 'Tenant QA',
            plan_nombre: 'Growth',
            total_empleados: 10,
            limite_empleados: 25,
            total_sucursales: 2,
            limite_sucursales: 5,
            marcaciones_mes: 120,
            saldo_pendiente: 49,
            facturas_vencidas: 1,
            riesgo_cobranza: true,
          }],
        }),
      });
    }

    if (/\/laboral\/\d{4}-\d{2}$/.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { mes: '2026-06', resumen: {}, items: [], cierre: null } }) });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { items: [], total: 0, resumen: {} } }),
    });
  });
}

test('login se mantiene utilizable y sin desborde horizontal', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Iniciar sesion' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
});

test('admin envia el tenant correcto al consultar empleados', async ({ page }) => {
  const tenantHeaders = [];
  const user = userFor('ADMIN_EMPRESA', { empleados: true });
  await mockApi(page, user, (request, url) => {
    if (url.pathname.endsWith('/empleados')) tenantHeaders.push(request.headers()['x-empresa-id']);
  });

  await page.goto('/empleados');
  await expect(page.getByRole('heading', { name: 'Empleados', exact: true })).toBeVisible();
  await expect.poll(() => tenantHeaders.filter(Boolean).length).toBeGreaterThan(0);
  expect(tenantHeaders.filter(Boolean).every((value) => value === empresaId)).toBeTruthy();
});

test('rrhh sin permiso de reportes es redirigido al dashboard', async ({ page }) => {
  await mockApi(page, userFor('RRHH', { reportes_avanzados: false }));
  await page.goto('/reportes');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
});

test('empleado puede abrir el flujo QR sin exponer datos internos', async ({ page }) => {
  await mockApi(page, userFor('EMPLEADO', { marcaciones: true, mis_marcaciones: true }));
  await page.goto('/marcaciones');
  await expect(page.getByRole('heading', { name: 'Marcar asistencia' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar camara' })).toBeVisible();
  await expect(page.getByText('TOKEN', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ASISTEPRO_SUCURSAL_DYNAMIC', { exact: false })).toHaveCount(0);
});

test('checkout registra transferencia con comprobante y tenant', async ({ page }) => {
  let paymentPayload;
  let paymentTenant;
  const user = userFor('ADMIN_EMPRESA', { facturacion: true });
  await mockApi(page, user, (request, url) => {
    if (url.pathname.endsWith('/facturacion/pagos/manual') && request.method() === 'POST') {
      paymentPayload = request.postDataJSON();
      paymentTenant = request.headers()['x-empresa-id'];
    }
  });

  await page.goto(`/checkout?factura_id=${facturaId}`);
  await page.locator('.checkout-form input').nth(0).fill('Banco QA');
  await page.locator('.checkout-form input').nth(1).fill('REF-E2E-001');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'comprobante.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 E2E'),
  });
  await page.getByRole('button', { name: 'Enviar comprobante' }).click();

  await expect(page.getByRole('heading', { name: 'Comprobante registrado' })).toBeVisible();
  expect(paymentTenant).toBe(empresaId);
  expect(paymentPayload.metodo).toBe('transferencia');
  expect(paymentPayload.referencia).toBe('REF-E2E-001');
  expect(paymentPayload.comprobante.nombre).toBe('comprobante.pdf');
});

test('empleado accede a solicitudes con permiso granular', async ({ page }) => {
  const user = userFor('EMPLEADO', { marcaciones: true }, { solicitudes: { ver: true, crear: true, aprobar: false } });
  await mockApi(page, user);
  await page.goto('/solicitudes');
  await expect(page.getByRole('heading', { name: 'Solicitudes y aprobaciones' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva solicitud' })).toBeVisible();
});

test('admin visualiza calculo laboral y cierre mensual', async ({ page }) => {
  const user = userFor('ADMIN_EMPRESA', {}, { calculo_laboral: { ver: true, exportar: true }, cierres_mensuales: { ver: true, cerrar: true, reabrir: true } });
  await mockApi(page, user);
  await page.goto('/calculo-laboral');
  await expect(page.getByRole('heading', { name: 'Calculo laboral' })).toBeVisible();
  await page.getByLabel('Mes de calculo').fill('2026-05');
  await expect(page.getByRole('button', { name: 'Cerrar mes' })).toBeVisible();
});

test('usuario sin permiso granular no puede abrir auditoria', async ({ page }) => {
  const user = userFor('RRHH', {}, { auditoria: { ver: false } });
  await mockApi(page, user);
  await page.goto('/auditoria');
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('rrhh con permiso puede abrir estructura organizacional', async ({ page }) => {
  const user = userFor('RRHH', { organizacion: true, importaciones: true }, { organizacion: { ver: true, crear: true, editar: true, eliminar: true }, importaciones: { ver: true, crear: true, exportar: true } });
  await mockApi(page, user);
  await page.goto('/organizacion');
  await expect(page.getByRole('heading', { name: 'Estructura organizacional' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Recursos Humanos' })).toBeVisible();
});

test('super admin puede abrir panel saas y cobranza', async ({ page }) => {
  const user = userFor('SUPER_ADMIN', {}, { saas_consumo: { ver: true, exportar: true } });
  await mockApi(page, user);
  await page.goto('/saas-control');
  await expect(page.getByRole('heading', { name: 'Panel SaaS y cobranza' })).toBeVisible();
  await expect(page.getByText('Tenant QA')).toBeVisible();
});
