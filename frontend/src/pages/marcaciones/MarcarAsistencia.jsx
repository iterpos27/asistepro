import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, MapPin, QrCode, Send, Square } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import * as marcacionService from '../../services/marcacionService';
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

export default function MarcarAsistencia() {
  const scannerRef = useRef(null);
  const [qrToken, setQrToken] = useState('');
  const [tipo, setTipo] = useState('entrada');
  const [motivoNovedad, setMotivoNovedad] = useState('');
  const [detalleNovedad, setDetalleNovedad] = useState('');
  const [pendingPayload, setPendingPayload] = useState(null);
  const [showNovedadModal, setShowNovedadModal] = useState(false);
  const [novedadError, setNovedadError] = useState('');
  const [ubicacion, setUbicacion] = useState(null);
  const [gpsPermission, setGpsPermission] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('');
  const [loadingGps, setLoadingGps] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    validarPermisoGPS().then(setGpsPermission);

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  async function startScanner() {
    setError('');
    setResult(null);
    setScannerStatus('Preparando camara...');
    setScanning(true);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(qrReaderId);
      }

      await new Promise((resolve) => requestAnimationFrame(resolve));
      const cameras = await Html5Qrcode.getCameras();

      if (!cameras.length) {
        throw new Error('No se encontro una camara disponible');
      }

      const backCamera =
        cameras.find((camera) => /back|rear|environment|trasera|posterior/i.test(camera.label)) || cameras[0];

      await scannerRef.current.start(
        backCamera.id,
        scannerConfig,
        async (decodedText) => {
          setQrToken(extractQrToken(decodedText));
          await stopScanner();
        },
      );
      setScannerStatus(`Camara activa${backCamera.label ? `: ${backCamera.label}` : ''}`);
    } catch (scannerError) {
      setError(scannerError.message || 'No se pudo iniciar la camara. Revisa permisos o ingresa el token manualmente.');
      setScannerStatus('');
      setScanning(false);
    }
  }

  async function stopScanner() {
    if (!scannerRef.current?.isScanning) {
      setScanning(false);
      return;
    }

    await scannerRef.current.stop().catch(() => {});
    await scannerRef.current.clear().catch(() => {});
    setScannerStatus('');
    setScanning(false);
  }

  async function requestGps() {
    setLoadingGps(true);
    setError('');

    try {
      const permission = await validarPermisoGPS();
      setGpsPermission(permission);

      if (!permission.ok) {
        setError(permission.message);
        return;
      }

      setUbicacion(await obtenerUbicacion());
    } catch {
      setError('No se pudo obtener la ubicacion GPS. Acepta el permiso del navegador para continuar.');
    } finally {
      setLoadingGps(false);
    }
  }

  async function registerMarcacion(payload, { allowNovedadPrompt = true } = {}) {
    setSubmitting(true);

    try {
      const response = await marcacionService.registrarMarcacion(payload);
      setResult(response);
      setPendingPayload(null);
      setShowNovedadModal(false);
      setMotivoNovedad('');
      setDetalleNovedad('');
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'No se pudo registrar la marcacion';

      if (allowNovedadPrompt && message.includes('motivo_novedad')) {
        setPendingPayload(payload);
        setShowNovedadModal(true);
        setNovedadError('');
        setError('');
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setResult(null);

    if (!qrToken.trim()) {
      setError('Ingresa o escanea un QR valido');
      return;
    }

    if (!ubicacion) {
      setError('Primero debes obtener la ubicacion GPS');
      return;
    }

    await registerMarcacion({
      qr_token: qrToken.trim(),
      tipo,
      latitud: ubicacion.latitud,
      longitud: ubicacion.longitud,
    });
  }

  async function confirmNovedad() {
    setNovedadError('');

    if (!motivoNovedad) {
      setNovedadError('Selecciona el motivo de la novedad');
      return;
    }

    if (!pendingPayload) {
      setNovedadError('No hay una marcacion pendiente para confirmar');
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
    setNovedadError('');
  }

  return (
    <>
      <PageHeader title="Marcar asistencia" description="Registra entrada o salida con QR y ubicacion GPS." />

      {error ? <div className="alert-error">{error}</div> : null}
      {result ? (
        <div className={result.marcacion?.estado === 'rechazada' ? 'alert-error' : 'alert-success'}>
          {result.mensaje || result.marcacion?.mensaje || `Marcacion ${result.marcacion?.estado || 'registrada'}`}
        </div>
      ) : null}

      <div className="panel">
        <PanelTitle title="Datos de marcacion" subtitle="Escanea el QR de la sucursal y confirma tu ubicacion GPS" />
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
                <div id={qrReaderId} className="qr-reader" />
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
                  : gpsPermission?.message || 'Solicita ubicacion antes de marcar'}
              </span>
            </div>
          </div>

          <div className="form-actions">
            <button className="outline-button" type="button" onClick={requestGps} disabled={loadingGps}>
              <MapPin size={16} />
              {loadingGps ? 'Obteniendo...' : 'Obtener GPS'}
            </button>
            <button className="primary-button compact" disabled={submitting || loadingGps}>
              <Send size={16} />
              {submitting ? 'Registrando...' : 'Registrar'}
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

            {novedadError ? <div className="alert-error">{novedadError}</div> : null}

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
    </>
  );
}
