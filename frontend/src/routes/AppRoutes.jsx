import { Suspense } from 'react';
import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { privateRoutes } from '../config/routes';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import { getDefaultRoute } from '../utils/roles';
import ProtectedRoute from './ProtectedRoute';

const Login = lazy(() => import('../pages/auth/Login'));
const Register = lazy(() => import('../pages/auth/Register'));
const Checkout = lazy(() => import('../pages/auth/Checkout'));

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
            <Suspense fallback={<PageLoader />}><AuthLayout><Login /></AuthLayout></Suspense>
          )
        }
      />
      <Route
        path="/register"
        element={
          auth.bootstrapping || auth.isAuthenticated ? (
            <Navigate to={getDefaultRoute(auth.user?.rol)} replace />
          ) : (
            <Suspense fallback={<PageLoader />}><AuthLayout><Register /></AuthLayout></Suspense>
          )
        }
      />
      <Route
        path="/checkout"
        element={
          <ProtectedRoute auth={auth}>
            <Suspense fallback={<PageLoader />}><AuthLayout><Checkout /></AuthLayout></Suspense>
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
                          <ProtectedRoute auth={auth} allowedRoles={route.roles} requiredFeature={route.feature} requiredPermission={route.permission}>
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
