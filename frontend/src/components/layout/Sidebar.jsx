import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { getNavSectionsForRole } from '../../config/navigation';
import { getRoleLabel } from '../../utils/roles';

export default function Sidebar({ open, onNavigate, user }) {
  const location = useLocation();
  const sections = getNavSectionsForRole(user?.rol);

  return (
    <aside className={open ? 'sidebar open' : 'sidebar'}>
      <div className="sidebar-brand">
        <div className="brand-icon">
          <ShieldCheck size={22} />
        </div>
        <div>
          <strong>AsistePro</strong>
          <span>Operacion SaaS</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div key={section.id} className="nav-section">
            <span className="nav-section-label">{section.label}</span>
            <div className="nav-list">
              {section.items.map((item) => {
                const active = location.pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    className={active ? 'nav-link active' : 'nav-link'}
                    to={item.href}
                    onClick={onNavigate}
                  >
                    <Icon size={18} />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{user?.nombre?.[0] || user?.email?.[0] || 'U'}</div>
        <div className="sidebar-user-meta">
          <strong>{user?.nombre ? `${user.nombre} ${user.apellido || ''}`.trim() : user?.email}</strong>
          <span>{getRoleLabel(user?.rol)}</span>
        </div>
      </div>
    </aside>
  );
}
