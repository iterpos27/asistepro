import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShieldCheck, ChevronDown } from 'lucide-react';
import { getNavSectionsForRole } from '../../config/navigation';

export default function Sidebar({ open, collapsed, onToggleCollapse, onNavigate, user }) {
  const location = useLocation();
  const sections = getNavSectionsForRole(user?.rol, user?.modulos, user?.permisos);

  const [expanded, setExpanded] = useState(() => {
    const initialExpanded = {};
    sections.forEach((section) => {
      const hasActive = section.items.some(
        (item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
      );
      if (hasActive) {
        initialExpanded[section.id] = true;
      }
    });
    return initialExpanded;
  });

  const lastPath = useRef(location.pathname);

  // Auto-expand active sections only when navigating to a new route
  useEffect(() => {
    if (lastPath.current !== location.pathname) {
      lastPath.current = location.pathname;
      const nextExpanded = { ...expanded };
      let changed = false;
      sections.forEach((section) => {
        const hasActive = section.items.some(
          (item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
        );
        if (hasActive && !expanded[section.id]) {
          nextExpanded[section.id] = true;
          changed = true;
        }
      });
      if (changed) {
        setExpanded(nextExpanded);
      }
    }
  }, [location.pathname, sections, expanded]);

  const toggleSection = (sectionId) => {
    setExpanded((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  let asideClasses = 'sidebar';
  if (open) asideClasses += ' open';
  if (collapsed) asideClasses += ' collapsed';

  return (
    <aside className={asideClasses}>
      <button
        className="sidebar-toggle"
        onClick={onToggleCollapse}
        type="button"
        title={collapsed ? 'Expandir menu' : 'Colapsar menu'}
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
        {sections.map((section) => {
          if (section.hideHeader) {
            return (
              <div key={section.id} className="nav-list standalone-nav-list">
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
            );
          }

          const isExpanded = collapsed || expanded[section.id];
          const hasActive = section.items.some(
            (item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
          );
          const SectionIcon = section.icon;

          return (
            <div
              key={section.id}
              className={`nav-section ${isExpanded ? 'expanded' : ''} ${hasActive ? 'active' : ''}`}
            >
              <button
                type="button"
                className="nav-section-header"
                onClick={() => toggleSection(section.id)}
                aria-expanded={isExpanded}
              >
                <div className="nav-section-title-wrap">
                  {SectionIcon && <SectionIcon size={16} className="nav-section-icon" />}
                  <span className="nav-section-label">{section.label}</span>
                </div>
                <ChevronDown size={14} className="nav-section-arrow" />
              </button>

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
          );
        })}
      </nav>
    </aside>
  );
}
