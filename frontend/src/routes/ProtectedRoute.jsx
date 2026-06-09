import { Navigate } from 'react-router-dom';
import { getDefaultRoute } from '../utils/roles';

export default function ProtectedRoute({ auth, allowedRoles, children }) {
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

  return children;
}
