import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Bell, Check, ClipboardCheck, Download, HardDriveDownload, RefreshCcw, ScanLine, Send, Smartphone } from 'lucide-react';
import MetricCard from '../../components/cards/MetricCard';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import { useAuthContext } from '../../context/AuthContext';
import { toast } from '../../services/toastService';
import * as notificacionService from '../../services/notificacionService';
import { ROLES } from '../../utils/roles';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export default function AppMovil() {
  const { user } = useAuthContext();
  const [installEvent, setInstallEvent] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [permission, setPermission] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [subscriptionState, setSubscriptionState] = useState('pendiente');
  const [swReady, setSwReady] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);

  const supportsPush = useMemo(
    () => 'serviceWorker' in navigator && 'PushManager' in window && Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY),
    [],
  );

  useEffect(() => {
    function onBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallEvent(event);
    }

    function updateOnline() {
      setOnline(navigator.onLine);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => navigator.serviceWorker.ready)
        .then(() => setSwReady(true))
        .catch(() => setSwReady(false));
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  async function loadNotifications() {
    setLoadingNotifications(true);
    try {
      const data = await notificacionService.listNotificaciones({ limit: 12 });
      setNotifications(data.items || []);
      setTotalNotifications(data.total || 0);
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudieron cargar las notificaciones');
    } finally {
      setLoadingNotifications(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function installApp() {
    if (!installEvent) {
      setInstallHelpOpen(true);
      return;
    }
    await installEvent.prompt();
    setInstallEvent(null);
    setInstallHelpOpen(false);
  }

  const shortcuts = [
    { label: 'Marcar asistencia', href: '/marcaciones', icon: ScanLine, roles: [ROLES.ADMIN_EMPRESA, ROLES.RRHH, ROLES.EMPLEADO] },
    { label: 'Mis marcaciones', href: '/mis-marcaciones', icon: Activity, roles: [ROLES.ADMIN_EMPRESA, ROLES.RRHH, ROLES.EMPLEADO] },
    { label: 'Solicitudes', href: '/solicitudes', icon: ClipboardCheck, roles: [ROLES.ADMIN_EMPRESA, ROLES.RRHH, ROLES.EMPLEADO] },
  ].filter((item) => item.roles.includes(user?.rol));

  async function enableNotifications() {
    if (typeof Notification === 'undefined') {
      toast.warning('Este navegador no soporta notificaciones');
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== 'granted') {
      toast.warning('Permiso de notificaciones no concedido');
      return;
    }

    if (!supportsPush) {
      setSubscriptionState('local');
      toast.success('Permiso concedido para notificaciones locales');
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
      });
    }
    await notificacionService.subscribePush(subscription.toJSON());
    setSubscriptionState('remota');
    toast.success('Suscripcion push registrada');
  }

  async function sendTestNotification() {
    try {
      await notificacionService.createTestNotification();
      await loadNotifications();
      toast.success('Aviso de prueba generado');
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo generar el aviso');
    }
  }

  async function markNotificationRead(id) {
    try {
      await notificacionService.markAsRead(id);
      setNotifications((current) => current.map((item) => (item.id === id ? { ...item, leido: true } : item)));
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo marcar como leida');
    }
  }

  async function markAllNotificationsRead() {
    try {
      await notificacionService.markAllAsRead();
      setNotifications((current) => current.map((item) => ({ ...item, leido: true })));
      toast.success('Notificaciones marcadas como leidas');
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudieron actualizar las notificaciones');
    }
  }

  function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('es-EC');
  }

  const unreadNotifications = notifications.filter((item) => !item.leido).length;

  return (
    <>
      <PageHeader
        title="Acceso web y PWA"
        description="Panel movil para marcaciones, solicitudes y avisos del usuario."
      />

      <section className="metrics-grid">
        <MetricCard label="Instalable" value={installEvent ? 'Si' : 'Listo'} icon={Smartphone} />
        <MetricCard label="Conexion" value={online ? 'Online' : 'Offline'} icon={HardDriveDownload} tone={online ? 'success' : 'warning'} />
        <MetricCard label="Avisos pendientes" value={unreadNotifications} icon={Bell} tone={unreadNotifications ? 'warning' : 'success'} />
        <MetricCard label="Service worker" value={swReady ? 'Activo' : 'Pendiente'} icon={Download} tone={swReady ? 'success' : 'accent'} />
      </section>

      <div className="dashboard-split">
        <div className="panel">
          <PanelTitle title="Instalacion web" subtitle={swReady ? 'Service worker activo' : 'Service worker pendiente'} />
          <div className="stack-list">
            <div className="list-row"><strong>Manifest</strong><span>Activo</span></div>
            <div className="list-row"><strong>Service worker</strong><span>{swReady ? 'Registrado' : 'No disponible'}</span></div>
            <div className="list-row"><strong>Modo install</strong><span>{installEvent ? 'Disponible' : 'Esperando navegador'}</span></div>
          </div>
          {installHelpOpen ? (
            <div className="alert-info" style={{ marginTop: '14px' }}>
              En Chrome movil abre el menu de tres puntos y usa "Agregar a pantalla principal" o "Instalar app". Si ya esta instalada, el navegador no vuelve a mostrar el instalador.
            </div>
          ) : null}
          <div className="form-actions">
            <button className="primary-button" type="button" onClick={installApp}>Instalar app</button>
          </div>
        </div>

        <div className="panel">
          <PanelTitle title="Notificaciones" subtitle={`${totalNotifications} avisos registrados`} />
          <div className="stack-list">
            <div className="list-row"><strong>Permission API</strong><span>{permission}</span></div>
            <div className="list-row"><strong>Push manager</strong><span>{supportsPush ? 'Disponible' : 'Configuracion local'}</span></div>
            <div className="list-row"><strong>Suscripcion</strong><span>{subscriptionState}</span></div>
          </div>
          <div className="form-actions">
            <button className="primary-button" type="button" onClick={enableNotifications}>
              <Bell size={16} />
              Activar
            </button>
            <button className="outline-button" type="button" onClick={sendTestNotification}>
              <Send size={16} />
              Probar
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <PanelTitle title="Accesos del empleado" subtitle="Flujos principales optimizados para usar desde el telefono." />
        <div className="quick-action-grid">
          {shortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Link className="quick-action-card" to={item.href} key={item.href}>
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <PanelTitle
          title="Bandeja de avisos"
          subtitle={loadingNotifications ? 'Cargando...' : `${unreadNotifications} pendientes`}
        />
        <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="outline-button" type="button" onClick={loadNotifications}>
            <RefreshCcw size={16} />
            Actualizar
          </button>
          <button className="outline-button" type="button" onClick={markAllNotificationsRead}>
            <Check size={16} />
            Marcar todo leido
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Aviso</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {notifications.length ? notifications.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.titulo}</strong>
                    <span className="table-subtext">{item.mensaje}</span>
                  </td>
                  <td>{item.tipo || 'general'}</td>
                  <td>{formatDate(item.creado_en)}</td>
                  <td><span className={item.leido ? 'status-pill muted' : 'status-pill warning'}>{item.leido ? 'Leido' : 'Pendiente'}</span></td>
                  <td>
                    {!item.leido ? (
                      <button className="icon-button" type="button" onClick={() => markNotificationRead(item.id)} title="Marcar leido" aria-label="Marcar leido">
                        <Check size={16} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="5">Sin avisos para mostrar.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
