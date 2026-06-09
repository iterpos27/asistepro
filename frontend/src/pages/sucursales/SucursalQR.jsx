import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, RefreshCcw, ShieldCheck } from 'lucide-react';
import PanelTitle from '../../components/common/PanelTitle';

export default function SucursalQR({ qrData, loading, onRotate, onRefreshDynamic }) {
  const [qrImage, setQrImage] = useState('');
  const [qrError, setQrError] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const refreshedExpirationRef = useRef(null);

  const qrValue = useMemo(() => {
    if (!qrData?.qr_payload) return '';
    return JSON.stringify(qrData.qr_payload);
  }, [qrData]);

  const payload = qrData ? JSON.stringify(qrData.qr_payload, null, 2) : '';
  const isDynamic = Boolean(qrData?.expira_en);

  useEffect(() => {
    let active = true;

    async function buildQr() {
      if (!qrValue) {
        setQrImage('');
        return;
      }

      try {
        const image = await QRCode.toDataURL(qrValue, {
          width: 260,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });
        if (active) {
          setQrImage(image);
          setQrError('');
        }
      } catch {
        if (active) {
          setQrImage('');
          setQrError('No se pudo generar la imagen QR');
        }
      }
    }

    buildQr();
    return () => {
      active = false;
    };
  }, [qrValue]);

  useEffect(() => {
    if (!qrData?.expira_en) {
      setRemainingSeconds(null);
      return undefined;
    }

    const expiresAt = new Date(qrData.expira_en).getTime();
    function tick() {
      const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(seconds);

      if (seconds === 0 && onRefreshDynamic && refreshedExpirationRef.current !== qrData.expira_en) {
        refreshedExpirationRef.current = qrData.expira_en;
        onRefreshDynamic();
      }
    }

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [onRefreshDynamic, qrData?.expira_en]);

  if (!qrData) return null;

  return (
    <div className="panel">
      <PanelTitle title="QR de sucursal" subtitle={isDynamic ? 'Token dinamico para marcaciones QR + GPS' : 'Payload usado para marcaciones QR + GPS'} />
      <div className="qr-box">
        <div className="qr-preview">
          {qrImage ? <img src={qrImage} alt="QR de sucursal para marcacion" /> : <span className="status-pill muted">Generando QR</span>}
          {qrError ? <small className="field-error">{qrError}</small> : null}
        </div>
        {isDynamic ? (
          <div className="alert-success compact-alert">
            <ShieldCheck size={16} />
            <span>QR dinamico: expira en {remainingSeconds ?? qrData.ttl_seconds ?? 30}s</span>
          </div>
        ) : null}
        <div className="qr-token">
          <strong>Token</strong>
          <span>{qrData.qr_token}</span>
        </div>
        <pre>{payload}</pre>
        <div className="form-actions">
          {qrImage ? (
            <a className="outline-button" href={qrImage} download={`asistepro-qr-${qrData.qr_token}.png`}>
              <Download size={16} />
              Descargar
            </a>
          ) : null}
          <button className="outline-button" type="button" onClick={onRotate} disabled={loading}>
            <RefreshCcw size={16} />
            {loading ? 'Rotando...' : 'Rotar QR'}
          </button>
          {onRefreshDynamic ? (
            <button className="outline-button" type="button" onClick={onRefreshDynamic} disabled={loading}>
              <ShieldCheck size={16} />
              {loading ? 'Renovando...' : 'Renovar dinamico'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
