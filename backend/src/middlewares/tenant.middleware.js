const tenantService = require('../services/tenant.service');

function getRequestedEmpresaId(req) {
  return req.headers['x-empresa-id'] || req.query.empresa_id || null;
}

async function tenantGuard(req, res, next) {
  try {
    if (!req.auth) {
      return res.status(401).json({
        ok: false,
        message: 'Autenticacion requerida',
      });
    }

    const requestedEmpresaId = getRequestedEmpresaId(req);
    const isSuperAdmin = req.auth.rol === 'SUPER_ADMIN';
    let empresaId = isSuperAdmin ? requestedEmpresaId : req.auth.empresa_id;

    if (!empresaId && isSuperAdmin) {
      const defaultEmpresa = await tenantService.findFirstActiveEmpresa();
      empresaId = defaultEmpresa?.id || null;
    }

    if (!empresaId) {
      return res.status(400).json({
        ok: false,
        message: 'empresa_id requerido para operaciones tenant',
      });
    }

    if (!isSuperAdmin && requestedEmpresaId && requestedEmpresaId !== req.auth.empresa_id) {
      return res.status(403).json({
        ok: false,
        message: 'No puede acceder a otra empresa',
      });
    }

    const empresa = await tenantService.findEmpresaById(empresaId);

    if (!empresa || empresa.estado !== 'activa') {
      return res.status(403).json({
        ok: false,
        message: 'Empresa no encontrada o inactiva',
      });
    }

    req.tenant = {
      empresa_id: empresa.id,
      empresa,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

async function subscriptionGuard(req, res, next) {
  try {
    if (!req.tenant?.empresa_id) {
      return res.status(400).json({
        ok: false,
        message: 'Tenant no resuelto',
      });
    }

    const subscription = await tenantService.findActiveSubscription(req.tenant.empresa_id);

    if (!subscription) {
      return res.status(403).json({
        ok: false,
        message: 'Suscripcion activa requerida',
      });
    }

    req.tenant.subscription = subscription;

    return next();
  } catch (error) {
    return next(error);
  }
}

function planGuard(allowedPlans = []) {
  return (req, res, next) => {
    const planCode = req.tenant?.subscription?.plan_codigo;

    if (!planCode) {
      return res.status(400).json({
        ok: false,
        message: 'Plan no resuelto',
      });
    }

    if (allowedPlans.length && !allowedPlans.includes(planCode)) {
      return res.status(403).json({
        ok: false,
        message: 'Plan no habilitado para esta operacion',
      });
    }

    return next();
  };
}

function planLimitGuard(resourceName) {
  return async (req, res, next) => {
    try {
      if (!req.tenant?.empresa_id || !req.tenant?.subscription) {
        return res.status(400).json({
          ok: false,
          message: 'Tenant o plan no resuelto',
        });
      }

      const includeNew =
        resourceName === 'empleados'
          ? { empleados: 1 }
          : resourceName === 'sucursales'
            ? { sucursales: 1 }
            : {};

      await tenantService.assertPlanCapacity({
        empresaId: req.tenant.empresa_id,
        plan: req.tenant.subscription,
        includeNew,
      });

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function featureGuard(featureName) {
  return (req, res, next) => {
    if (!req.tenant?.empresa_id) {
      return res.status(400).json({
        ok: false,
        message: 'Tenant no resuelto para verificar permisos de modulos',
      });
    }

    if (req.auth?.rol === 'SUPER_ADMIN') {
      return next();
    }

    const configuracionModulos = req.auth?.user?.modulos || req.tenant?.empresa?.configuracion_modulos || {};
    const isEnabled = configuracionModulos[featureName] === true;

    if (!isEnabled) {
      return res.status(403).json({
        ok: false,
        message: `El modulo '${featureName}' no esta habilitado para su empresa`,
      });
    }

    return next();
  };
}

module.exports = {
  tenantGuard,
  subscriptionGuard,
  planGuard,
  planLimitGuard,
  featureGuard,
};
