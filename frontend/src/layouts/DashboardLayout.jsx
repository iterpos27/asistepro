import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import { useAuthContext } from '../context/AuthContext';

export default function DashboardLayout({ user, children }) {
  const navigate = useNavigate();
  const auth = useAuthContext();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  async function logout() {
    await auth.logout();
    navigate('/login');
  }

  return (
    <div className={collapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <Sidebar
        open={open}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onNavigate={() => setOpen(false)}
        user={user}
      />
      {open ? <button className="sidebar-backdrop" type="button" aria-label="Cerrar menu" onClick={() => setOpen(false)} /> : null}
      <div className="content-area">
        <Topbar user={user} onOpenMenu={() => setOpen(true)} onLogout={logout} />
        <main className="page">
          <div className="page-inner">{children}</div>
          <footer className="app-footer">
            <span>&copy; {new Date().getFullYear()} AsistePro &bull; Creado por <strong>IPS TECH</strong></span>
          </footer>
        </main>
      </div>
    </div>
  );
}
