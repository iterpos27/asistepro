import { useEffect, useRef, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import { api } from '../../services/api';
import { preparePilotFile } from './adms-pilot-file';
import AdmsSyncPanel from './AdmsSyncPanel';

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
  const [selected, setSelected] = useState(null);
  const [employeeId, setEmployeeId] = useState('');
  const [tipo, setTipo] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [receptionConsent, setReceptionConsent] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [batchEditing, setBatchEditing] = useState(false);
  const confirmationRef = useRef(null);
  const types = { entrada: 'Entrada', salida_almuerzo: 'Salida al almuerzo', entrada_almuerzo: 'Regreso del almuerzo', salida: 'Salida' };

  useEffect(() => {
    if (selected) {
      confirmationRef.current?.focus();
      confirmationRef.current?.scrollIntoView({ block: 'center' });
    }
  }, [selected]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    api.get(`/integraciones/${integration.id}/adms`, { params: { fecha, pagina }, skipToast: true })
      .then(response => { if (!cancelled) setData(response.data.data); })
      .catch(err => { if (!cancelled) setError(err.response?.data?.message || 'No se pudo consultar la bandeja.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [integration.id, fecha, pagina, revision]);

  useEffect(() => {
    if (!autoRefresh || saving || selected || preview || loading || batchEditing) return;
    const timer = setTimeout(() => setRevision(value => value + 1), 30000);
    return () => clearTimeout(timer);
  }, [autoRefresh, saving, selected, preview, loading, revision, batchEditing]);

  async function toggleReception() {
    setSaving(true); setError(''); setNotice('');
    try {
      const activa = !data.dispositivo.recepcion_directa;
      await api.post(`/integraciones/${integration.id}/adms/recepcion`, { activa, revision_manual: true }, { skipToast: true });
      setNotice(activa ? 'Recepción directa activada. Esperando conexión y registros del biométrico.' : 'Recepción directa pausada. Los datos guardados se conservan.');
      setReceptionConsent(false); setRevision(value => value + 1);
    } catch (err) { setError(err.response?.data?.message || 'No se pudo cambiar la recepción.'); }
    finally { setSaving(false); }
  }

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

  function selectEvent(row) {
    setSelected(row); setEmployeeId(data.vinculos?.[row.dispositivo_usuario_id] || '');
    setTipo(''); setConfirmed(false); setError(''); setNotice(''); setPreview(null);
  }

  async function importSelected(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const response = await api.post(`/integraciones/${integration.id}/adms/importar`, {
        referencia: selected.referencia, empleado_id: employeeId, tipo, confirmado: confirmed,
      }, { skipToast: true });
      setNotice(response.data.data.nueva ? 'Marcación incorporada a asistencia. Ya puede consultarse en Historial y Reportes.' : 'Esta marcación ya estaba importada; no se duplicó.');
      setSelected(null); setRevision(value => value + 1);
    } catch (err) { setError(err.response?.data?.message || 'No se pudo confirmar la importación. Puedes reintentar sin duplicar el evento.'); }
    finally { setSaving(false); }
  }

  const selectedEmployee = data?.empleados?.find(employee => employee.id === employeeId);

  return <>
    <PageHeader title="Bandeja del biométrico" description={integration.nombre}
      actions={<button type="button" className="outline-button" disabled={saving} onClick={onBack}>Volver</button>} />
    <div className="panel">
      <p><strong>Conexión directa ADMS · sin computadora en la empresa.</strong></p>
      <p>El biométrico envía sus registros a producción por HTTPS. Vincula cada ID una vez y usa «Sincronizar vinculados» para incorporarlos a asistencia por lote.</p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="toolbar-grid">
        <label>Fecha del reloj (Ecuador)<input type="date" value={fecha} disabled={saving} onChange={e => {
          setFecha(e.target.value); setPagina(1); setPreview(null); setSelected(null); setNotice('');
        }} /></label>
        <button type="button" className="outline-button" disabled={loading || saving || !fecha} onClick={() => setRevision(value => value + 1)}>Actualizar bandeja</button>
        <label><input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />Actualizar pantalla cada 30 segundos</label>
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
      {data?.dispositivo && <>
        <p>Serie: <strong>{data.dispositivo.serial}</strong> · Sucursal: <strong>{data.dispositivo.sucursal_nombre}</strong></p>
        <p>Recepción directa: <strong>{data.dispositivo.recepcion_directa ? 'Activada' : 'Pausada'}</strong> · Último contacto declarado: {data.dispositivo.ultimo_contacto_en ? new Date(data.dispositivo.ultimo_contacto_en).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }) : 'Sin contacto'}</p>
        <p>Último lote guardado: {data.dispositivo.ultimo_lote_en ? `${new Date(data.dispositivo.ultimo_lote_en).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })} · ${data.dispositivo.ultimo_lote_registros} recibidos · ${data.dispositivo.ultimo_lote_nuevos} nuevos` : 'Esperando registros del reloj'}</p>
        <p>Seguridad: la serie no autentica al remitente. Al sincronizar autorizas incorporar los eventos de la fecha seleccionada según los vínculos y reglas guardados. No se aceptan huellas, rostros ni fotos.</p>
        {!data.dispositivo.recepcion_directa && <label><input type="checkbox" checked={receptionConsent} disabled={saving} onChange={e => setReceptionConsent(e.target.checked)} />Acepto recibir registros sin autenticación del equipo y revisarlos manualmente antes de incorporarlos a asistencia.</label>}
        <button type="button" className="outline-button" disabled={saving || (!data.dispositivo.recepcion_directa && !receptionConsent)} onClick={toggleReception}>{data.dispositivo.recepcion_directa ? 'Pausar recepción directa' : 'Activar recepción directa'}</button>
        <AdmsSyncPanel integrationId={integration.id} data={data} fecha={fecha} busy={saving || loading || Boolean(error)}
          onBusy={setSaving} onEditing={setBatchEditing} onChanged={() => setRevision(value => value + 1)} />
        <p><strong>{data.total}</strong> registros en la bandeja para {data.fecha}. Revisa la situación de cada evento.</p>
        <label>Cargar archivo JSON del piloto (solo la fecha seleccionada)
          <input type="file" accept=".json,application/json" disabled={saving} onChange={chooseFile} />
        </label>
        {preview && <div>
          <p>Se enviarán {preview.payload.records.length} registros del {fecha} a esta empresa y sucursal. No se importarán a asistencia.</p>
          <button type="button" className="primary-button" disabled={saving} onClick={upload}>Confirmar carga manual a la bandeja</button>
          <button type="button" className="outline-button" disabled={saving} onClick={() => setPreview(null)}>Cancelar carga</button>
        </div>}
        {selected && <form className="stack-form" onSubmit={importSelected} ref={confirmationRef} tabIndex={-1} aria-label="Importar una marcación">
          <h2>Vincular e importar un evento</h2>
          <p>ID del reloj <strong>{selected.dispositivo_usuario_id}</strong> · {selected.fecha_hora_local} (Ecuador) · {data.dispositivo.sucursal_nombre}</p>
          {selected.origen === 'adms_sin_verificar' && <p role="alert">Evento ADMS sin autenticación del remitente. Verifica que la marcación sea real antes de confirmar; la serie por sí sola no lo demuestra.</p>}
          <label>Empleado confirmado<select required value={employeeId} disabled={saving} onChange={e => { setEmployeeId(e.target.value); setConfirmed(false); }}>
            <option value="">Selecciona el empleado</option>
            {(data.empleados || []).map(employee => <option key={employee.id} value={employee.id}>{employee.nombres} {employee.apellidos} · {employee.codigo}</option>)}
          </select></label>
          <label>Tipo confirmado<select required value={tipo} disabled={saving} onChange={e => { setTipo(e.target.value); setConfirmed(false); }}>
            <option value="">Selecciona entrada o salida</option>
            {Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <p>Se guardará el vínculo de este ID con el empleado y se incorporará únicamente este evento a asistencia. Los demás eventos seguirán pendientes de revisión, aunque la recepción ADMS esté activada.</p>
          {selectedEmployee && tipo && <label><input type="checkbox" required checked={confirmed} disabled={saving} onChange={e => setConfirmed(e.target.checked)} />Confirmo que corresponde a {selectedEmployee.nombres} {selectedEmployee.apellidos}, como {types[tipo]}, y autorizo incorporarla a asistencia y cálculos laborales.</label>}
          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={saving || !confirmed || !employeeId || !tipo}>Confirmar vínculo e importar este evento</button>
            <button type="button" className="outline-button" disabled={saving} onClick={() => setSelected(null)}>Cancelar importación</button>
          </div>
        </form>}
        <div className="table-wrap"><table>
          <thead><tr><th>ID del reloj</th><th>Fecha y hora del reloj</th><th>Estado original</th><th>Verificación</th><th>Origen</th><th>Situación</th></tr></thead>
          <tbody>{data.items.length ? data.items.map(row => <tr key={row.referencia}>
            <td>{row.dispositivo_usuario_id}</td><td>{row.fecha_hora_local}</td><td>{row.estado_dispositivo}</td>
            <td>{row.verificacion}</td><td>{row.origen === 'adms_sin_verificar' ? 'ADMS directo · sin verificar' : 'Piloto · carga manual'}{row.adms_recibido_en && <small> · Recibido por ADMS</small>}</td><td>{row.marcacion_id
              ? <>{row.anulada ? 'Anulada' : row.estado_marcacion === 'rechazada' ? 'Rechazada' : 'Importada'} · {row.empleado_nombre} · {types[row.tipo] || row.tipo}</>
              : <>Pendiente; no importada <button type="button" className="outline-button" disabled={saving} onClick={() => selectEvent(row)} aria-label={`Importar ID ${row.dispositivo_usuario_id} del ${row.fecha_hora_local}`}>Vincular e importar</button></>}</td>
          </tr>) : <tr><td colSpan="6">Sin marcaciones recibidas para esta fecha.</td></tr>}</tbody>
        </table></div>
        <div className="form-actions">
          <button type="button" className="outline-button" disabled={saving || pagina === 1} onClick={() => { setSelected(null); setPagina(value => value - 1); }}>Anterior</button>
          <span>Página {pagina} de {Math.max(1, Math.ceil(data.total / 50))}</span>
          <button type="button" className="outline-button" disabled={saving || pagina * 50 >= data.total} onClick={() => { setSelected(null); setPagina(value => value + 1); }}>Siguiente</button>
        </div>
      </>}
    </div>
  </>;
}
