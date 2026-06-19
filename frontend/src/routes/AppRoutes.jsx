import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { privateRoutes } from '../config/routes';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import Checkout from '../pages/auth/Checkout';
import { getDefaultRoute } from '../utils/roles';
import ProtectedRoute from './ProtectedRoute';

function PageLoader() {
  return (
    <div className="page-loader">
      <div className="loader-card">
        <span className="loader-dot" />
        <span>Cargando</span>
      </div>
    </div>
  );
}

export default function AppRoutes({ auth }) {
  const homeRoute = auth.bootstrapping || auth.isAuthenticated ? getDefaultRoute(auth.user?.rol) : '/login';

  return (
    <Routes>
      <Route path="/" element={<Navigate to={homeRoute} replace />} />
      <Route
        path="/login"
        element={
          auth.bootstrapping || auth.isAuthenticated ? (
            <Navigate to={getDefaultRoute(auth.user?.rol)} replace />
          ) : (
            <AuthLayout>
              <Login />
            </AuthLayout>
          )
        }
      />
      <Route
        path="/register"
        element={
          auth.bootstrapping || auth.isAuthenticated ? (
            <Navigate to={getDefaultRoute(auth.user?.rol)} replace />
          ) : (
            <AuthLayout>
              <Register />
            </AuthLayout>
          )
        }
      />
      <Route
        path="/checkout"
        element={
          <ProtectedRoute auth={auth}>
            <AuthLayout>
              <Checkout />
            </AuthLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute auth={auth}>
            <DashboardLayout user={auth.user}>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {privateRoutes.map((route) => {
                    const Page = route.element;
                    return (
                      <Route
                        key={route.path}
                        path={route.path}
                        element={
                          <ProtectedRoute auth={auth} allowedRoles={route.roles} requiredFeature={route.feature}>
                            <Page />
                          </ProtectedRoute>
                        }
                      />
                    );
                  })}
                  <Route path="*" element={<Navigate to={getDefaultRoute(auth.user?.rol)} replace />} />
                </Routes>
              </Suspense>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
