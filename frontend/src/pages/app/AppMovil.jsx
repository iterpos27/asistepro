import { useEffect, useMemo, useState } from 'react';
import { Bell, Download, HardDriveDownload, Smartphone } from 'lucide-react';
import MetricCard from '../../components/cards/MetricCard';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import { toast } from '../../services/toastService';
import * as notificacionService from '../../services/notificacionService';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export default function AppMovil() {
  const [installEvent, setInstallEvent] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [permission, setPermission] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [subscriptionState, setSubscriptionState] = useState('pendiente');

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
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  async function installApp() {
    if (!installEvent) {
      toast.warning('El navegador aun no ofrece la instalacion');
      return;
    }
    await installEvent.prompt();
    setInstallEvent(null);
  }

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

  return (
    <>
      <PageHeader
        title="App movil y PWA"
        description="Instalacion, modo offline y notificaciones para que el sistema funcione mejor desde celular sin depender del navegador abierto."
      />

      <section className="metrics-grid">
        <MetricCard label="Instalable" value={installEvent ? 'Si' : 'Listo'} icon={Smartphone} />
        <MetricCard label="Conexion" value={online ? 'Online' : 'Offline'} icon={HardDriveDownload} tone={online ? 'success' : 'warning'} />
        <MetricCard label="Notificaciones" value={permission} icon={Bell} tone={permission === 'granted' ? 'success' : 'accent'} />
        <MetricCard label="Push" value={subscriptionState} icon={Download} tone="accent" />
      </section>

      <div className="dashboard-split">
        <div className="panel">
          <PanelTitle title="Instalacion" subtitle="Abre la app como experiencia nativa en Android o escritorio compatible." />
          <div className="stack-list">
            <div className="list-row"><strong>Manifest</strong><span>Activo</span></div>
            <div className="list-row"><strong>Service worker</strong><span>{'serviceWorker' in navigator ? 'Registrado' : 'No disponible'}</span></div>
            <div className="list-row"><strong>Modo install</strong><span>{installEvent ? 'Disponible' : 'Esperando navegador'}</span></div>
          </div>
          <div className="form-actions">
            <button className="primary-button" type="button" onClick={installApp}>Instalar app</button>
          </div>
        </div>

        <div className="panel">
          <PanelTitle title="Notificaciones" subtitle="Permite avisos de marcaciones, aprobaciones y alertas operativas." />
          <div className="stack-list">
            <div className="list-row"><strong>Permission API</strong><span>{permission}</span></div>
            <div className="list-row"><strong>Push manager</strong><span>{supportsPush ? 'Disponible' : 'Configuracion local'}</span></div>
          </div>
          <div className="form-actions">
            <button className="primary-button" type="button" onClick={enableNotifications}>Activar notificaciones</button>
          </div>
        </div>
      </div>
    </>
  );
}
