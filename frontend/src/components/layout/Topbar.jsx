import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, CircleUserRound, LogOut, Menu, Settings } from 'lucide-react';
import { navSections } from '../../config/navigation';
import { ROLES, getRoleLabel } from '../../utils/roles';
import EmpresaSelector from './EmpresaSelector';

export default function Topbar({ user, onOpenMenu, onLogout }) {
  const location = useLocation();
  const isSuperAdmin = user?.rol === ROLES.SUPER_ADMIN;
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const activeItem = navSections
    .flatMap((section) => section.items)
    .find((item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`));
  const displayName = user?.nombre ? `${user.nombre} ${user.apellido || ''}`.trim() : user?.email || 'Usuario';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  useEffect(() => {
    function handlePointerDown(event) {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setAccountOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setAccountOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header className="topbar">
      <button className="icon-button mobile-only" onClick={onOpenMenu} type="button" aria-label="Abrir menu">
        <Menu size={20} />
      </button>

      <div className="topbar-title">
        <span className="topbar-kicker">AsistePro</span>
        <strong>{activeItem?.title || 'Panel operativo'}</strong>
        <p>{user?.empresa || user?.email || 'Sesion operativa'}</p>
      </div>

      <div className="topbar-actions">
        {isSuperAdmin ? <EmpresaSelector /> : null}
        <span className="role-badge">{getRoleLabel(user?.rol)}</span>
        <div className="account-menu" ref={accountRef}>
          <button
            className="account-trigger"
            type="button"
            onClick={() => setAccountOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
          >
            <span className="account-avatar">{initials || 'U'}</span>
            <span className="account-trigger-text">
              <strong>{displayName}</strong>
              <span>{user?.email || 'Sesion activa'}</span>
            </span>
            <ChevronDown size={16} />
          </button>

          {accountOpen ? (
            <div className="account-dropdown" role="menu">
              <div className="account-card">
                <span className="account-avatar large">{initials || 'U'}</span>
                <div>
                  <strong>{displayName}</strong>
                  <span>{user?.email || 'Sin correo registrado'}</span>
                </div>
              </div>
              <div className="account-meta">
                <span>Empresa</span>
                <strong>{user?.empresa || (isSuperAdmin ? 'Seleccion por tenant' : 'Sin empresa')}</strong>
              </div>
              <div className="account-meta">
                <span>Perfil</span>
                <strong>{getRoleLabel(user?.rol)}</strong>
              </div>
              <Link className="dropdown-action" to="/settings" onClick={() => setAccountOpen(false)} role="menuitem">
                <CircleUserRound size={16} />
                Perfil de usuario
              </Link>
              <Link className="dropdown-action" to="/settings" onClick={() => setAccountOpen(false)} role="menuitem">
                <Settings size={16} />
                Ajustes
              </Link>
              <button className="dropdown-action danger" type="button" onClick={onLogout} role="menuitem">
                <LogOut size={16} />
                Salir
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
