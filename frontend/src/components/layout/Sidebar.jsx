import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { getNavSectionsForRole } from '../../config/navigation';

export default function Sidebar({ open, collapsed, onToggleCollapse, onNavigate, user }) {
  const location = useLocation();
  const sections = getNavSectionsForRole(user?.rol, user?.modulos, user?.permisos);

  let asideClasses = 'sidebar';
  if (open) asideClasses += ' open';
  if (collapsed) asideClasses += ' collapsed';

  return (
    <aside className={asideClasses}>
      <button
        className="sidebar-toggle"
        onClick={onToggleCollapse}
        type="button"
        aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

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
                const active = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
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
    </aside>
  );
}
