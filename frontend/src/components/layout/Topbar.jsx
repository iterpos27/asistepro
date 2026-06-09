import { LogOut, Menu } from 'lucide-react';
import { ROLES, getRoleLabel } from '../../utils/roles';
import EmpresaSelector from './EmpresaSelector';

export default function Topbar({ user, onOpenMenu, onLogout }) {
  const isSuperAdmin = user?.rol === ROLES.SUPER_ADMIN;

  return (
    <header className="topbar">
      <button className="icon-button mobile-only" onClick={onOpenMenu} type="button" aria-label="Abrir menu">
        <Menu size={20} />
      </button>

      <div className="topbar-title">
        <strong>{user?.empresa || 'AsistePro'}</strong>
        <p>{user?.email || 'Sesion activa'}</p>
      </div>

      <div className="topbar-actions">
        {isSuperAdmin ? <EmpresaSelector /> : null}
        <span className="role-badge">{getRoleLabel(user?.rol)}</span>
        <button className="outline-button" type="button" onClick={onLogout}>
          <LogOut size={16} />
          Salir
        </button>
      </div>
    </header>
  );
}
