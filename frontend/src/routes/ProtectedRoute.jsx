import { Navigate } from 'react-router-dom';
import { getDefaultRoute } from '../utils/roles';

export default function ProtectedRoute({ auth, allowedRoles, requiredFeature, requiredPermission, children }) {
  if (auth.bootstrapping) {
    return (
      <div className="page-loader">
        <div className="loader-card">
          <span className="loader-dot" />
          <span>Cargando sesion</span>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) return <Navigate to="/login" replace />;

  if (allowedRoles?.length && auth.user?.rol && !allowedRoles.includes(auth.user.rol)) {
    return <Navigate to={getDefaultRoute(auth.user.rol)} replace />;
  }

  if (requiredFeature && auth.user?.rol && auth.user.rol !== 'SUPER_ADMIN') {
    const userModulos = auth.user.modulos || {};
    if (userModulos[requiredFeature] !== true) {
      return <Navigate to={getDefaultRoute(auth.user.rol)} replace />;
    }
  }

  if (requiredPermission && auth.user?.rol !== 'SUPER_ADMIN') {
    const [resource, action] = requiredPermission;
    if (auth.user?.permisos?.[resource]?.[action] !== true) return <Navigate to={getDefaultRoute(auth.user?.rol)} replace />;
  }

  return children;
}
