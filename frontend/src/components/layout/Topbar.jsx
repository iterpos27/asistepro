import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Bell, CalendarClock, Check, Clock, ChevronDown, CircleUserRound, LogOut, Menu, Settings } from 'lucide-react';
import { navSections } from '../../config/navigation';
import { ROLES, getRoleLabel } from '../../utils/roles';
import EmpresaSelector from './EmpresaSelector';
import * as notificacionService from '../../services/notificacionService';

export default function Topbar({ user, onOpenMenu, onLogout }) {
  const location = useLocation();
  const isSuperAdmin = user?.rol === ROLES.SUPER_ADMIN;
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationsRef = useRef(null);
  const seenNotificationIds = useRef(new Set());

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

  async function fetchNotifications() {
    try {
      const data = await notificacionService.listNotificaciones({ limit: 10 });
      setNotifications(data.items || []);
      const unread = data.items.filter((item) => !item.leido).length;
      setUnreadCount(unread);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        data.items
          .filter((item) => !item.leido && !seenNotificationIds.current.has(item.id))
          .slice(0, 2)
          .forEach((item) => {
            seenNotificationIds.current.add(item.id);
            const registration = navigator.serviceWorker?.ready;
            if (registration) {
              registration.then((sw) => sw.showNotification(item.titulo, { body: item.mensaje, tag: item.id })).catch(() => {
                new Notification(item.titulo, { body: item.mensaje });
              });
            } else {
              new Notification(item.titulo, { body: item.mensaje });
            }
          });
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }

  async function markAllAsRead() {
    try {
      await notificacionService.markAllAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, leido: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }

  async function markOneAsRead(id) {
    try {
      await notificacionService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, leido: true } : item))
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setAccountOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setAccountOpen(false);
        setNotificationsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMin = Math.round(diffMs / 60000);

    if (diffMin < 1) return 'Hace un momento';
    if (diffMin === 1) return 'Hace 1 min';
    if (diffMin < 60) return `Hace ${diffMin} min`;

    const diffHrs = Math.round(diffMin / 60);
    if (diffHrs === 1) return 'Hace 1 hora';
    if (diffHrs < 24) return `Hace ${diffHrs} horas`;

    const diffDays = Math.round(diffHrs / 24);
    if (diffDays === 1) return 'Ayer';
    return `Hace ${diffDays} días`;
  }

  function getNotificationIcon(tipo) {
    switch (tipo) {
      case 'marcacion_novedad':
        return { icon: AlertTriangle, className: 'marcacion_novedad' };
      case 'reemplazo':
        return { icon: CalendarClock, className: 'reemplazo' };
      case 'horario':
        return { icon: Clock, className: 'horario' };
      default:
        return { icon: Bell, className: 'general' };
    }
  }

  const getNotificationsLink = () => {
    if (user?.rol === ROLES.SUPER_ADMIN) return '/empresas';
    if ([ROLES.ADMIN_EMPRESA, ROLES.RRHH].includes(user?.rol)) return '/reportes';
    return '/mis-marcaciones';
  };

  return (
    <header className="topbar">
      <button className="icon-button mobile-only" onClick={onOpenMenu} type="button" title="Abrir menu" aria-label="Abrir menu">
        <Menu size={20} />
      </button>

      <strong className="topbar-mobile-title">{activeItem?.title || 'Panel operativo'}</strong>

      <div className="topbar-actions">
        {isSuperAdmin ? <EmpresaSelector /> : null}
        <span className="role-badge">{getRoleLabel(user?.rol)}</span>

        <div className="topbar-notifications" ref={notificationsRef}>
          <button
            className="notifications-trigger"
            type="button"
            onClick={() => setNotificationsOpen((open) => !open)}
            title="Notificaciones"
            aria-label="Notificaciones"
            aria-haspopup="true"
            aria-expanded={notificationsOpen}
          >
            <Bell size={20} />
            {unreadCount > 0 && <span className="notifications-badge" />}
          </button>

          {notificationsOpen && (
            <div className="notifications-dropdown">
              <div className="notifications-header">
                <h3>
                  Notificaciones
                  {unreadCount > 0 && <span className="notifications-count">{unreadCount}</span>}
                </h3>
                {unreadCount > 0 && (
                  <button className="notifications-mark-read" type="button" onClick={markAllAsRead}>
                    Marcar todo leido
                  </button>
                )}
              </div>

              <div className="notifications-list">
                {notifications.length > 0 ? (
                  notifications.map((notif) => {
                    const { icon: Icon, className } = getNotificationIcon(notif.tipo);
                    return (
                      <div
                        key={notif.id}
                        className={notif.leido ? 'notification-item' : 'notification-item unread'}
                        onClick={async () => {
                          await markOneAsRead(notif.id);
                          setNotificationsOpen(false);
                        }}
                      >
                        <div className={`notification-icon-wrapper ${className}`}>
                          <Icon size={18} />
                        </div>
                        <div className="notification-content">
                          <h4 className="notification-title">{notif.titulo}</h4>
                          <p className="notification-message">{notif.mensaje}</p>
                          <span className="notification-time">{formatTimeAgo(notif.creado_en)}</span>
                        </div>
                        {!notif.leido && <span className="notification-unread-dot" />}
                      </div>
                    );
                  })
                ) : (
                  <div className="notifications-empty">Sin notificaciones nuevas</div>
                )}
              </div>

              <div className="notifications-footer">
                <Link
                  className="notifications-view-all"
                  to={getNotificationsLink()}
                  onClick={() => setNotificationsOpen(false)}
                >
                  Ver centro operativo
                </Link>
              </div>
            </div>
          )}
        </div>

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
