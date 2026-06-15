import { Navigate } from 'react-router-dom';
import { getDefaultRoute } from '../utils/roles';

export default function ProtectedRoute({ auth, allowedRoles, requiredFeature, children }) {
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

  return children;
}
