import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Download, RefreshCcw } from 'lucide-react';
import PanelTitle from '../../components/common/PanelTitle';

export default function SucursalQR({ qrData, loading, onRotate }) {
  const [qrImage, setQrImage] = useState('');
  const [qrError, setQrError] = useState('');

  const qrValue = useMemo(() => {
    if (!qrData?.qr_payload) return '';
    return JSON.stringify(qrData.qr_payload);
  }, [qrData]);

  const payload = qrData ? JSON.stringify(qrData.qr_payload, null, 2) : '';

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

  if (!qrData) return null;

  return (
    <div className="panel">
      <PanelTitle title="QR de sucursal" subtitle="Payload usado para marcaciones QR + GPS" />
      <div className="qr-box">
        <div className="qr-preview">
          {qrImage ? <img src={qrImage} alt="QR de sucursal para marcacion" /> : <span className="status-pill muted">Generando QR</span>}
          {qrError ? <small className="field-error">{qrError}</small> : null}
        </div>
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
        </div>
      </div>
    </div>
  );
}
