import { AuthProvider } from './context/AuthContext';
import AppRoutes from './routes/AppRoutes';
import useAuth from './hooks/useAuth';

function AppContent() {
  const auth = useAuth();

  return <AppRoutes auth={auth} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
