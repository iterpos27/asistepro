import { useState } from 'react';
import { api } from '../../services/api';

const TYPES = { entrada: 'Entrada', salida: 'Salida', salida_almuerzo: 'Salida al almuerzo', entrada_almuerzo: 'Regreso del almuerzo' };

export default function AdmsSyncPanel({ integrationId, data, fecha, busy, onBusy, onEditing, onChanged }) {
  const [mode, setMode] = useState('');
  const [uid, setUid] = useState('');
  const [employee, setEmployee] = useState('');
  const [rules, setRules] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const base = `/integraciones/${integrationId}/adms`;
  const stateKeys = [...new Set(['0', '1', '4', '5', ...Object.keys(data.estados_mapeo || {}), ...data.items.map(row => String(row.estado_dispositivo))])].sort((a, b) => Number(a) - Number(b));
  function edit(next) {
    setMode(next); onEditing(Boolean(next)); setMessage(''); setError('');
    if (next === 'rules') setRules(data.estados_mapeo || {});
  }
  async function save(event) {
    event.preventDefault(); onBusy(true); setError(''); setMessage('');
    try {
      await api.post(`${base}/${mode === 'link' ? 'vincular' : 'estados'}`, mode === 'link'
        ? { dispositivo_usuario_id: uid.trim(), empleado_id: employee }
        : { estados_mapeo: Object.fromEntries(Object.entries(rules).filter(([, value]) => value)) }, { skipToast: true });
      setMessage(mode === 'link' ? 'Vínculo guardado. No necesitas vincular cada marcación.' : 'Reglas guardadas. Los estados sin regla quedarán pendientes.');
      setMode(''); onEditing(false); onChanged();
    } catch (err) { setError(err.response?.data?.message || 'No se pudo guardar.'); }
    finally { onBusy(false); }
  }
  async function synchronize() {
    onBusy(true); setError(''); setMessage('');
    const summary = { nuevas: 0, existentes: 0, sin_vinculo: 0, sin_tipo: 0, errores: 0, detalles: [] };
    let despues;
    try {
      do {
        const response = await api.post(`${base}/sincronizar`, { fecha, ...(despues ? { despues } : {}) }, { skipToast: true, timeout: 60000 });
        const batch = response.data.data;
        for (const key of ['nuevas', 'existentes', 'sin_vinculo', 'sin_tipo']) summary[key] += batch[key];
        summary.errores += batch.errores.length;
        summary.detalles = [...summary.detalles, ...batch.errores].slice(0, 20);
        setResult({ ...summary });
        despues = batch.siguiente;
      } while (despues);
      setMessage('Sincronización terminada. Las nuevas marcaciones ya están en Historial y Reportes.');
    } catch (err) {
      setError(`${err.response?.data?.message || 'Se interrumpió la sincronización.'} Las marcaciones ya guardadas se conservan; puedes reintentar sin duplicarlas.`);
    } finally { onBusy(false); onChanged(); }
  }
  return <section className="panel" aria-label="Sincronizar usuarios vinculados">
    <h2>Vincular una vez · sincronizar marcaciones</h2>
    <p>La recepción desde el reloj ya es automática. Este botón incorpora a asistencia los registros del {fecha}, de todas las páginas, solo para IDs vinculados y estados con regla configurada.</p>
    <div className="form-actions">
      <button type="button" className="outline-button" disabled={busy} onClick={() => edit('link')}>Vincular usuario</button>
      <button type="button" className="outline-button" disabled={busy} onClick={() => edit('rules')}>Configurar tipos del equipo</button>
      <button type="button" className="primary-button" disabled={busy || Boolean(mode) || !Object.keys(data.estados_mapeo || {}).length || !Object.keys(data.vinculos || {}).length} onClick={synchronize}>Sincronizar vinculados</button>
    </div>
    {!Object.keys(data.estados_mapeo || {}).length && <p>Falta configurar qué significa cada estado del reloj. No se deduce entrada/salida por la hora ni por el orden.</p>}
    <p>Vínculos guardados: {Object.entries(data.vinculos || {}).map(([id, employeeId]) => {
      const person = data.empleados.find(item => item.id === employeeId);
      return `${id} → ${person ? `${person.nombres} ${person.apellidos} (${person.codigo})` : 'Empleado no activo'}`;
    }).join(' · ') || 'Ninguno'}</p>
    {mode && <form className="stack-form" onSubmit={save}>
      {mode === 'link' ? <>
        <label>ID del usuario en el biométrico<input required maxLength={24} pattern="[A-Za-z0-9_-]+" value={uid} disabled={busy} onChange={event => setUid(event.target.value)} /></label>
        <label>Empleado del sistema<select required value={employee} disabled={busy} onChange={event => setEmployee(event.target.value)}>
          <option value="">Selecciona el empleado</option>
          {data.empleados.map(person => <option key={person.id} value={person.id}>{person.nombres} {person.apellidos} · {person.codigo}</option>)}
        </select></label>
        <p>Guardar solo vincula el ID. No importa marcaciones ni reasigna vínculos existentes.</p>
      </> : <>
        <p>Define una vez el significado de los estados según la configuración real de este equipo. Afectará a los eventos pendientes; no cambia lo ya importado.</p>
        {stateKeys.map(key => <label key={key}>Estado {key}<select value={rules[key] || ''} disabled={busy} onChange={event => setRules(value => ({ ...value, [key]: event.target.value }))}>
          <option value="">Sin regla · dejar pendiente</option>
          {Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>)}
      </>}
      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={busy}>{mode === 'link' ? 'Guardar vínculo' : 'Guardar reglas del equipo'}</button>
        <button type="button" className="outline-button" disabled={busy} onClick={() => edit('')}>Cancelar</button>
      </div>
    </form>}
    {busy && <p role="status">Procesando… No cierres esta pantalla hasta terminar.</p>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {result && <div role="status">
      <p>{result.nuevas} nuevas · {result.existentes} ya procesadas · {result.sin_vinculo} sin vínculo · {result.sin_tipo} sin regla · {result.errores} con incidencias.</p>
      {result.detalles.map(item => <p key={item.referencia}>ID {item.dispositivo_usuario_id}: {item.motivo}</p>)}
    </div>}
  </section>;
}
