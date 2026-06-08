import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import { useAuthContext } from '../context/AuthContext';

export default function DashboardLayout({ user, children }) {
  const navigate = useNavigate();
  const auth = useAuthContext();
  const [open, setOpen] = useState(false);

  async function logout() {
    await auth.logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      <div className="content-area">
        <Topbar user={user} onOpenMenu={() => setOpen(true)} onLogout={logout} />
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
