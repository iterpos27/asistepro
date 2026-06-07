function getTenantEmpresaId(req) {
  if (!req.tenant?.empresa_id) {
    const error = new Error('empresa_id no resuelto en tenant');
    error.statusCode = 400;
    throw error;
  }

  return req.tenant.empresa_id;
}

function assertSameTenant(req, empresaId) {
  const tenantEmpresaId = getTenantEmpresaId(req);

  if (tenantEmpresaId !== empresaId) {
    const error = new Error('Recurso fuera del tenant actual');
    error.statusCode = 403;
    throw error;
  }
}

module.exports = {
  getTenantEmpresaId,
  assertSameTenant,
};
