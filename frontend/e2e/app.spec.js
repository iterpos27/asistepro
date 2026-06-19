import { expect, test } from '@playwright/test';

const empresaId = '11111111-1111-4111-8111-111111111111';
const facturaId = '22222222-2222-4222-8222-222222222222';

function userFor(role, modulos = {}) {
  return {
    id: `user-${role.toLowerCase()}`,
    empresa_id: role === 'SUPER_ADMIN' ? null : empresaId,
    empresa: role === 'SUPER_ADMIN' ? null : 'Tenant QA',
    nombres: 'Usuario',
    apellidos: role,
    email: `${role.toLowerCase()}@qa.local`,
    rol: role,
    modulos,
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
  await expect(page.getByRole('heading', { name: 'Dashboard RRHH', exact: true })).toBeVisible();
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
  await page.getByLabel('Banco o entidad').fill('Banco QA');
  await page.getByLabel('Numero de referencia').fill('REF-E2E-001');
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
