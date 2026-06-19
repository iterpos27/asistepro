import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, MapPin, QrCode, Send, Square } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import * as marcacionService from '../../services/marcacionService';
import { toast } from '../../services/toastService';
import { obtenerUbicacion, validarPermisoGPS } from '../../utils/gps';

const motivos = ['Reemplazo', 'Apoyo temporal', 'Emergencia', 'Autorizacion supervisor', 'Otro'];
const qrReaderId = 'asistepro-qr-reader';
const scannerConfig = {
  fps: 10,
  qrbox: { width: 240, height: 240 },
  aspectRatio: 1,
};

function extractQrToken(decodedText) {
  try {
    const payload = JSON.parse(decodedText);
    return payload.qr_token || decodedText;
  } catch {
    return decodedText;
  }
}

function withTimeout(promise, milliseconds = 1500) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    }),
  ]);
}

export default function MarcarAsistencia() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const scanLockedRef = useRef(false);
  const [readerKey, setReaderKey] = useState(0);
  const [qrToken, setQrToken] = useState('');
  const [tipo, setTipo] = useState('entrada');
  const [motivoNovedad, setMotivoNovedad] = useState('');
  const [detalleNovedad, setDetalleNovedad] = useState('');
  const [pendingPayload, setPendingPayload] = useState(null);
  const [showNovedadModal, setShowNovedadModal] = useState(false);
  const [ubicacion, setUbicacion] = useState(null);
  const [gpsPermission, setGpsPermission] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('');
  const [loadingGps, setLoadingGps] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    validarPermisoGPS().then(setGpsPermission);

    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner?.isScanning) {
        scanner.stop().catch(() => {});
      }
      scanner?.clear?.().catch(() => {});
      clearReaderDom({ remount: false });
    };
  }, []);

  function stopReaderVideoTracks() {
    const reader = document.getElementById(qrReaderId);
    const videos = reader?.querySelectorAll('video') || [];

    videos.forEach((video) => {
      const stream = video.srcObject;
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach((track) => track.stop());
      }
      video.srcObject = null;
    });
  }

  function clearReaderDom({ remount = true } = {}) {
    stopReaderVideoTracks();
    const reader = document.getElementById(qrReaderId);
    if (reader) {
      reader.replaceChildren();
    }
    if (remount) {
      setReaderKey((current) => current + 1);
    }
  }

  async function startScanner() {
    scanLockedRef.current = false;
    setScannerStatus('Preparando camara...');

    try {
      await stopScanner();
      clearReaderDom();
      setScanning(true);
      setScannerStatus('Preparando camara...');
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const { Html5Qrcode } = await import('html5-qrcode');
      const cameras = await Html5Qrcode.getCameras();

      if (!cameras.length) {
        throw new Error('No se encontro una camara disponible');
      }

      const backCamera =
        cameras.find((camera) => /back|rear|environment|trasera|posterior/i.test(camera.label)) || cameras[0];

      scannerRef.current = new Html5Qrcode(qrReaderId);
      await scannerRef.current.start(
        backCamera.id,
        scannerConfig,
        async (decodedText) => {
          if (scanLockedRef.current) return;
          scanLockedRef.current = true;
          try {
            const detectedToken = extractQrToken(decodedText);
            setQrToken(detectedToken);
            setScannerStatus('QR detectado. Cerrando camara y obteniendo GPS...');
            await stopScanner();
            await registerWithFreshGps(detectedToken);
          } catch (callbackError) {
            console.error('Error en callback de escaneo:', callbackError);
            toast.error(callbackError.message || 'Error al procesar la marcacion del QR');
            scanLockedRef.current = false;
          }
        },
      );
      setScannerStatus(`Camara activa${backCamera.label ? `: ${backCamera.label}` : ''}`);
    } catch (scannerError) {
      await stopScanner();
      toast.error(scannerError.message || 'No se pudo iniciar la camara. Revisa permisos o ingresa el token manualmente.');
    }
  }

  async function stopScanner({ keepStatus = false } = {}) {
    setScanning(false);
    const scanner = scannerRef.current;

    if (!keepStatus) {
      setScannerStatus('');
    }
    scannerRef.current = null;
    scanLockedRef.current = false;

    if (!scanner) {
      clearReaderDom();
      return;
    }

    try {
      if (scanner.isScanning) {
        await withTimeout(scanner.stop().catch(() => {}));
      }
      if (typeof scanner.clear === 'function') {
        await withTimeout(scanner.clear().catch(() => {}), 700);
      }
    } catch (stopError) {
      console.error('Error al detener el escaner:', stopError);
    } finally {
      clearReaderDom();
    }
  }

  function clearMarcacionForm() {
    setQrToken('');
    setUbicacion(null);
    setPendingPayload(null);
    setShowNovedadModal(false);
    setMotivoNovedad('');
    setDetalleNovedad('');
  }

  async function requestGps() {
    return refreshGps();
  }

  async function refreshGps() {
    setLoadingGps(true);

    try {
      const permission = await validarPermisoGPS();
      setGpsPermission(permission);

      if (!permission.ok) {
        toast.error(permission.message);
        return null;
      }

      const nextUbicacion = await obtenerUbicacion();
      setUbicacion(nextUbicacion);
      return nextUbicacion;
    } catch (gpsError) {
      toast.error(gpsError.message || 'No se pudo obtener la ubicacion GPS. Acepta el permiso del navegador para continuar.');
      return null;
    } finally {
      setLoadingGps(false);
    }
  }

  async function registerMarcacion(payload, { allowNovedadPrompt = true } = {}) {
    setSubmitting(true);

    try {
      const response = await marcacionService.registrarMarcacion(payload);
      if (response.marcacion?.estado === 'rechazada') {
        toast.warning(response.mensaje || response.marcacion?.mensaje || 'Marcacion registrada con advertencia');
      } else {
        toast.success(response.mensaje || response.marcacion?.mensaje || 'Marcacion registrada correctamente');
        navigate('/mis-marcaciones');
      }
      clearMarcacionForm();
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'No se pudo registrar la marcacion';

      if (allowNovedadPrompt && message.includes('motivo_novedad')) {
        setPendingPayload(payload);
        setShowNovedadModal(true);
      } else {
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function registerWithFreshGps(token) {
    const cleanToken = token.trim();

    if (!cleanToken) {
      toast.error('Ingresa o escanea un QR valido');
      return;
    }

    const nextUbicacion = await refreshGps();
    if (!nextUbicacion) return;

    await registerMarcacion({
      qr_token: cleanToken,
      tipo,
      latitud: nextUbicacion.latitud,
      longitud: nextUbicacion.longitud,
      precision_gps: nextUbicacion.precision_metros,
    });
  }

  async function submit(event) {
    event.preventDefault();
    await registerWithFreshGps(qrToken);
  }

  async function confirmNovedad() {
    if (!motivoNovedad) {
      toast.error('Selecciona el motivo de la novedad');
      return;
    }

    if (!pendingPayload) {
      toast.error('No hay una marcacion pendiente para confirmar');
      return;
    }

    await registerMarcacion(
      {
        ...pendingPayload,
        motivo_novedad: motivoNovedad,
        detalle_novedad: detalleNovedad || undefined,
      },
      { allowNovedadPrompt: false },
    );
  }

  function closeNovedadModal() {
    setShowNovedadModal(false);
    setPendingPayload(null);
    setMotivoNovedad('');
    setDetalleNovedad('');
  }

  return (
    <>
      <PageHeader title="Marcar asistencia" description="Registra entrada o salida con QR y ubicacion GPS." />

      <div className="panel">
        <PanelTitle title="Datos de marcacion" subtitle="Escanea el QR o registra manualmente; el GPS se obtiene automaticamente" />
        <form className="module-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="wide-field">
              QR token
              <div className="input-with-icon">
                <QrCode size={16} />
                <input value={qrToken} onChange={(event) => setQrToken(event.target.value)} placeholder="Pega el qr_token de la sucursal" />
              </div>
            </label>

            <div className="wide-field">
              <div className={scanning ? 'qr-reader-shell active' : 'qr-reader-shell'}>
                <div key={readerKey} id={qrReaderId} className="qr-reader" />
                {scannerStatus ? <span className="qr-reader-status">{scannerStatus}</span> : null}
              </div>
              <div className="form-actions">
                <button className="outline-button" type="button" onClick={startScanner} disabled={scanning}>
                  <Camera size={16} />
                  Iniciar camara
                </button>
                <button className="outline-button" type="button" onClick={stopScanner} disabled={!scanning}>
                  <Square size={16} />
                  Detener
                </button>
              </div>
            </div>

            <label>
              Tipo
              <select value={tipo} onChange={(event) => setTipo(event.target.value)}>
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
              </select>
            </label>
          </div>

          <div className="gps-status">
            <MapPin size={18} />
            <div>
              <strong>{ubicacion ? 'GPS listo' : 'GPS requerido'}</strong>
              <span>
                {ubicacion
                  ? `${ubicacion.latitud.toFixed(7)}, ${ubicacion.longitud.toFixed(7)} - precision ${Math.round(ubicacion.precision_metros || 0)} m`
                  : gpsPermission?.message || 'El GPS se solicitara al marcar'}
              </span>
            </div>
          </div>

          <div className="form-actions">
            <button className="outline-button" type="button" onClick={requestGps} disabled={loadingGps}>
              <MapPin size={16} />
              {loadingGps ? 'Obteniendo...' : 'Actualizar GPS'}
            </button>
            <button className="primary-button compact" disabled={submitting || loadingGps}>
              <Send size={16} />
              {submitting || loadingGps ? 'Registrando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>

      {showNovedadModal ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-label="Sucursal diferente">
            <PanelTitle
              title="Sucursal diferente"
              subtitle="Estas marcando en una sucursal diferente. Selecciona el motivo."
            />

            <div className="module-form">
              <label>
                Motivo novedad
                <select value={motivoNovedad} onChange={(event) => setMotivoNovedad(event.target.value)}>
                  <option value="">Selecciona un motivo</option>
                  {motivos.map((motivo) => (
                    <option key={motivo} value={motivo}>
                      {motivo}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Detalle novedad
                <input value={detalleNovedad} onChange={(event) => setDetalleNovedad(event.target.value)} placeholder="Opcional" />
              </label>
            </div>

            <div className="form-actions">
              <button className="outline-button" type="button" onClick={closeNovedadModal} disabled={submitting}>
                Cancelar
              </button>
              <button className="primary-button compact" type="button" onClick={confirmNovedad} disabled={submitting}>
                <Send size={16} />
                {submitting ? 'Registrando...' : 'Confirmar novedad'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {(submitting || loadingGps) && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="loader-card">
            <span className="loader-dot" />
            <span>
              {submitting ? 'Registrando marcacion...' : 'Obteniendo GPS preciso...'}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
