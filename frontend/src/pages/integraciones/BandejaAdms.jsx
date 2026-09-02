import { useEffect, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import { api } from '../../services/api';
import { preparePilotFile } from './adms-pilot-file';

export default function BandejaAdms({ integration, sucursales, onBack, onChanged }) {
  const [fecha, setFecha] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date()));
  const [pagina, setPagina] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [serial, setSerial] = useState('');
  const [sucursal, setSucursal] = useState(integration.configuracion?.sucursal_id || '');
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setData(null);
    api.get(`/integraciones/${integration.id}/adms`, { params: { fecha, pagina }, skipToast: true })
      .then(response => { if (!cancelled) setData(response.data.data); })
      .catch(err => { if (!cancelled) setError(err.response?.data?.message || 'No se pudo consultar la bandeja.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [integration.id, fecha, pagina, revision]);

  async function register(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await api.post(`/integraciones/${integration.id}/adms/registro`, { serial: serial.trim(), sucursal_id: sucursal }, { skipToast: true });
      setNotice('Equipo registrado. La recepcion publica sigue bloqueada.');
      setRevision(value => value + 1);
      await onChanged();
    } catch (err) { setError(err.response?.data?.message || 'No se pudo registrar el equipo.'); }
    finally { setSaving(false); }
  }

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setPreview(null); setError(''); setNotice('');
    if (!file) return;
    setSaving(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera 10 MB.');
      setPreview(preparePilotFile(await file.text(), data.dispositivo.serial, fecha));
    } catch (err) { setError(err.message || 'Archivo invalido.'); }
    finally { setSaving(false); }
  }

  async function upload() {
    setSaving(true); setError('');
    try {
      const response = await api.post(`/integraciones/${integration.id}/adms/piloto`, preview, { skipToast: true });
      const result = response.data.data;
      setNotice(`${result.nuevas} nuevas, ${result.duplicadas} duplicadas. Ninguna incorporada a asistencia.`);
      setPreview(null); setRevision(value => value + 1);
    } catch (err) { setError(err.response?.data?.message || 'No se pudo guardar la carga; puedes reintentar sin duplicados.'); }
    finally { setSaving(false); }
  }

  return <>
    <PageHeader title="Bandeja del biométrico" description={integration.nombre}
      actions={<button type="button" className="outline-button" disabled={saving} onClick={onBack}>Volver</button>} />
    <div className="panel">
      <p><strong>Recepción pública bloqueada. Importación a asistencia no habilitada.</strong></p>
      <p>HTTPS está en diagnóstico. Esta bandeja muestra cargas manuales del piloto; no demuestra sincronización automática ni modifica reportes o nómina.</p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="toolbar-grid">
        <label>Fecha del reloj (Ecuador)<input type="date" value={fecha} disabled={saving} onChange={e => {
          setFecha(e.target.value); setPagina(1); setPreview(null); setNotice('');
        }} /></label>
        <button type="button" className="outline-button" disabled={loading || saving || !fecha} onClick={() => setRevision(value => value + 1)}>Actualizar bandeja</button>
      </div>
      {loading && <p role="status">Consultando registros…</p>}
      {!loading && data && !data.dispositivo && <form className="stack-form" onSubmit={register}>
        <h2>Registrar dispositivo</h2>
        <p>La serie y sucursal quedarán fijas para proteger el historial. Registrar no habilita la conexión pública.</p>
        <label>Número de serie<input required maxLength={40} pattern="[A-Za-z0-9_-]+" value={serial} disabled={saving} onChange={e => setSerial(e.target.value)} /></label>
        <label>Sucursal<select required value={sucursal} disabled={saving} onChange={e => setSucursal(e.target.value)}>
          <option value="">Selecciona la sucursal</option>
          {sucursales.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
        </select></label>
        <button className="primary-button" type="submit" disabled={saving}>Registrar equipo y sucursal</button>
      </form>}
      {!loading && data?.dispositivo && <>
        <p>Serie: <strong>{data.dispositivo.serial}</strong> · Sucursal: <strong>{data.dispositivo.sucursal_nombre}</strong></p>
        <p><strong>{data.total}</strong> registros en la bandeja para {data.fecha}. Pendientes de vinculación y clasificación.</p>
        <label>Cargar archivo JSON del piloto (solo la fecha seleccionada)
          <input type="file" accept=".json,application/json" disabled={saving} onChange={chooseFile} />
        </label>
        {preview && <div>
          <p>Se enviarán {preview.payload.records.length} registros del {fecha} a esta empresa y sucursal. No se importarán a asistencia.</p>
          <button type="button" className="primary-button" disabled={saving} onClick={upload}>Confirmar carga manual a la bandeja</button>
          <button type="button" className="outline-button" disabled={saving} onClick={() => setPreview(null)}>Cancelar carga</button>
        </div>}
        <div className="table-wrap"><table>
          <thead><tr><th>ID del reloj</th><th>Fecha y hora del reloj</th><th>Estado original</th><th>Verificación</th><th>Origen</th><th>Situación</th></tr></thead>
          <tbody>{data.items.length ? data.items.map(row => <tr key={row.referencia}>
            <td>{row.dispositivo_usuario_id}</td><td>{row.fecha_hora_local}</td><td>{row.estado_dispositivo}</td>
            <td>{row.verificacion}</td><td>Piloto · carga manual</td><td>Pendiente; no importada</td>
          </tr>) : <tr><td colSpan="6">Sin marcaciones recibidas para esta fecha.</td></tr>}</tbody>
        </table></div>
        <div className="form-actions">
          <button type="button" className="outline-button" disabled={saving || pagina === 1} onClick={() => setPagina(value => value - 1)}>Anterior</button>
          <span>Página {pagina} de {Math.max(1, Math.ceil(data.total / 50))}</span>
          <button type="button" className="outline-button" disabled={saving || pagina * 50 >= data.total} onClick={() => setPagina(value => value + 1)}>Siguiente</button>
        </div>
      </>}
    </div>
  </>;
}
