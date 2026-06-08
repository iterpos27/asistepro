import { Navigate, Route, Routes } from 'react-router-dom';
import { privateRoutes } from '../config/routes';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import Login from '../pages/auth/Login';
import ProtectedRoute from './ProtectedRoute';

export default function AppRoutes({ auth }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={auth.isAuthenticated ? '/dashboard' : '/login'} replace />} />
      <Route
        path="/login"
        element={
          auth.isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <AuthLayout>
              <Login />
            </AuthLayout>
          )
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute auth={auth}>
            <DashboardLayout user={auth.user}>
              <Routes>
                {privateRoutes.map((route) => {
                  const Page = route.element;
                  return (
                    <Route
                      key={route.path}
                      path={route.path}
                      element={
                        <ProtectedRoute auth={auth} allowedRoles={route.roles}>
                          <Page />
                        </ProtectedRoute>
                      }
                    />
                  );
                })}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
