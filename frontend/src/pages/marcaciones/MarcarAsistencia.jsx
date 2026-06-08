import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, MapPin, QrCode, Send, Square } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import * as marcacionService from '../../services/marcacionService';
import { obtenerUbicacion, validarPermisoGPS } from '../../utils/gps';

const motivos = ['Reemplazo', 'Apoyo temporal', 'Emergencia', 'Autorizacion supervisor', 'Otro'];
const qrReaderId = 'asistepro-qr-reader';

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
  const [ubicacion, setUbicacion] = useState(null);
  const [gpsPermission, setGpsPermission] = useState(null);
  const [scanning, setScanning] = useState(false);
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

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(qrReaderId);
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          setQrToken(extractQrToken(decodedText));
          await stopScanner();
        },
      );
      setScanning(true);
    } catch {
      setError('No se pudo iniciar la camara. Revisa permisos o ingresa el token manualmente.');
      setScanning(false);
    }
  }

  async function stopScanner() {
    if (!scannerRef.current?.isScanning) {
      setScanning(false);
      return;
    }

    await scannerRef.current.stop().catch(() => {});
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

    setSubmitting(true);

    try {
      const response = await marcacionService.registrarMarcacion({
        qr_token: qrToken.trim(),
        tipo,
        latitud: ubicacion.latitud,
        longitud: ubicacion.longitud,
        motivo_novedad: motivoNovedad || undefined,
        detalle_novedad: detalleNovedad || undefined,
      });
      setResult(response);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo registrar la marcacion');
    } finally {
      setSubmitting(false);
    }
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
              <div id={qrReaderId} className={scanning ? 'qr-reader active' : 'qr-reader'} />
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
            <label>
              Motivo novedad
              <select value={motivoNovedad} onChange={(event) => setMotivoNovedad(event.target.value)}>
                <option value="">Sin novedad</option>
                {motivos.map((motivo) => (
                  <option key={motivo} value={motivo}>
                    {motivo}
                  </option>
                ))}
              </select>
            </label>
            <label className="wide-field">
              Detalle novedad
              <input value={detalleNovedad} onChange={(event) => setDetalleNovedad(event.target.value)} placeholder="Opcional" />
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
    </>
  );
}
