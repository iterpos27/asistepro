function getTenantContext(req, res) {
  res.json({
    ok: true,
    data: {
      empresa: req.tenant.empresa,
      subscription: req.tenant.subscription,
      auth: {
        usuario_id: req.auth.usuario_id,
        rol: req.auth.rol,
      },
    },
  });
}

module.exports = {
  getTenantContext,
};
