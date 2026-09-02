import { useEffect, useRef, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import * as integracionService from '../../services/integracionService';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
const formatDate = (value) => value ? new Intl.DateTimeFormat('es-EC', {
  timeZone: 'America/Guayaquil', dateStyle: 'short', timeStyle: 'medium',
}).format(new Date(value)) : 'Sin registros';
const errorMessage = (error) => error.response?.data?.message || error.message || 'No se pudo completar la operación';

export default function UsuariosBiometrico({ integration, onBack, onChanged }) {
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [employeeId, setEmployeeId] = useState('');
  const [recoverDate, setRecoverDate] = useState(today);
  const confirmationRef = useRef(null);
  const feedbackRef = useRef(null);
  const loadedIntegrationRef = useRef(null);

  async function load(fecha = date) {
    setBusy(true);
    setError('');
    setData(null);
    setSelected(null);
    try {
      setData(await integracionService.listUsuariosBiometrico(integration.id, fecha));
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (loadedIntegrationRef.current === integration.id) return;
    loadedIntegrationRef.current = integration.id;
    load(today());
  }, [integration.id]); // Evitar la doble lectura inicial de StrictMode.

  useEffect(() => {
    if (!selected) return;
    confirmationRef.current?.focus({ preventScroll: true });
    confirmationRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [selected]);

  useEffect(() => {
    if (!error && !result) return;
    feedbackRef.current?.focus({ preventScroll: true });
    feedbackRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [error, result]);

  function selectUser(user) {
    setSelected(user);
    setEmployeeId(data.empleados.find(employee => employee.codigo.toUpperCase() === user.empleado_codigo?.toUpperCase())?.id || '');
    setRecoverDate(data.fecha_desde);
    setResult(null);
    setError('');
  }

  async function confirmLink(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await integracionService.vincularUsuarioBiometrico(integration.id, {
        dispositivo_usuario_id: selected.dispositivo_usuario_id,
        empleado_id: employeeId,
        fecha_desde: recoverDate,
      });
      setResult(response);
      setSelected(null);
      // Mantener el resultado visible aunque falle la nueva lectura del equipo.
      await load(date);
      await onChanged();
    } catch (err) {
      setError(`${errorMessage(err)}. Si la solicitud se interrumpió, consulta el equipo antes de reintentar: el vínculo podría haberse guardado.`);
    } finally { setBusy(false); }
  }

  const selectedEmployee = data?.empleados.find(employee => employee.id === employeeId);
  const items = (data?.items || []).filter(user => (!pendingOnly || user.estado !== 'vinculado')
    && `${user.dispositivo_usuario_id} ${user.nombre} ${user.empleado_nombre || ''} ${user.empleado_codigo || ''}`.toLowerCase().includes(search.toLowerCase()));
  const status = data?.integracion || integration;

  return <>
    <PageHeader title="Usuarios del biométrico" description={integration.nombre}
      actions={<button type="button" className="outline-button" disabled={busy} onClick={onBack}>Volver a Integraciones</button>} />
    <div className="panel">
      <PanelTitle title="Conexión y sincronización" subtitle="Consulta local del equipo. Las horas se muestran en horario de Ecuador." />
      <p>Integración: <strong>{status.estado}</strong> · Última sincronización: {formatDate(status.ultima_sincronizacion_en)} · Resultado: {status.ultima_ejecucion_estado || 'Sin ejecuciones'}</p>
      <p>Último ciclo: {status.ultima_ejecucion_resumen?.sincronizadas ?? 0} nuevas, {status.ultima_ejecucion_resumen?.rechazadas ?? 0} rechazadas.</p>
      {status.ultima_ejecucion_resumen?.error && <p role="alert">{status.ultima_ejecucion_resumen.error}</p>}
      <p>La sincronización automática necesita la computadora, el servicio local y el biométrico encendidos. Un vínculo no activa una integración pausada.</p>
      <form className="toolbar-grid" onSubmit={(event) => { event.preventDefault(); setResult(null); load(); }}>
        <label style={{ display: 'grid', gap: 8 }}>Consultar marcaciones desde
          <input type="date" required max={today()} value={date} disabled={busy} onChange={event => setDate(event.target.value)} />
        </label>
        <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Leyendo equipo…' : 'Consultar equipo / actualizar'}</button>
      </form>
      {data && <p>Conexión comprobada: {formatDate(data.leido_en)}. Desde {data.fecha_desde}: <strong>{data.resumen.usuarios}</strong> usuarios, <strong>{data.resumen.sin_vincular}</strong> sin vínculo y <strong>{data.resumen.marcaciones_sin_vincular}</strong> marcaciones sin vincular.</p>}
      {(error || result) && <div ref={feedbackRef} tabIndex={-1} style={{ scrollMarginTop: 110 }}>
      {error && <p role="alert">{error}</p>}
      {result && <div role="status">
        <p>Vínculo guardado. {result.importacion_pendiente ? 'La importación quedó pendiente; el siguiente ciclo activo reintentará.' : `${result.resumen?.sincronizadas || 0} marcaciones nuevas importadas; ${result.resumen?.rechazadas || 0} rechazadas en el ciclo.`}</p>
        {result.errores?.length > 0 && <ul>{result.errores.slice(0, 20).map((item, index) => <li key={index}>{item.empleado_codigo ? `${item.empleado_codigo}: ` : ''}{item.motivo}</li>)}</ul>}
      </div>}
      </div>}
    </div>

    {selected && data && <div className="panel" ref={confirmationRef} tabIndex={-1} style={{ scrollMarginTop: 110 }}>
      <PanelTitle title={`Confirmar usuario ${selected.dispositivo_usuario_id} — ${selected.nombre || 'Sin nombre'}`} subtitle="Revisa la identidad antes de importar. No se vincula por coincidencia de nombre automáticamente." />
      <form className="stack-form" onSubmit={confirmLink}>
        <label style={{ display: 'grid', gap: 8 }}>Empleado de AsistePro
          <select required aria-describedby="biometric-link-help" value={employeeId} disabled={busy || Boolean(selected.empleado_codigo)} onChange={event => setEmployeeId(event.target.value)}>
            <option value="">Selecciona el empleado</option>
            {data.empleados.map(employee => <option key={employee.id} value={employee.id}>{employee.nombre} — {employee.codigo} — {employee.sucursal_nombre || 'Sin sucursal'}</option>)}
          </select>
        </label>
        <p id="biometric-link-help">{employeeId ? 'Empleado seleccionado. Revisa la fecha y confirma para guardar el vínculo e importar.' : 'Primero selecciona el empleado de AsistePro. El botón de confirmación se habilitará al elegirlo.'}</p>
        <label style={{ display: 'grid', gap: 8 }}>Recuperar desde (se guarda para este usuario)
          <input type="date" required max={today()} value={recoverDate} disabled={busy} onChange={event => setRecoverDate(event.target.value)} />
        </label>
        {selectedEmployee && <p>El ID <strong>{selected.dispositivo_usuario_id}</strong> quedará asociado a <strong>{selectedEmployee.nombre} ({selectedEmployee.codigo})</strong>. Las marcaciones se registrarán en la sucursal del equipo desde <strong>{recoverDate}</strong>, sin crear duplicados de eventos ya importados.</p>}
        {selectedEmployee && selectedEmployee.sucursal_habitual_id !== data.integracion.sucursal_id && <p role="alert">Atención: la sucursal habitual del empleado es diferente a la del equipo. Confirma que la marcación corresponde a esta sucursal.</p>}
        <div className="form-actions">
          <button className="outline-button" type="button" disabled={busy} onClick={() => setSelected(null)}>Cancelar</button>
          <button className="primary-button" type="submit" aria-describedby="biometric-link-help" style={busy || !employeeId ? { opacity: 0.5, cursor: 'not-allowed' } : undefined} disabled={busy || !employeeId}>{busy ? 'Guardando y recuperando…' : selected.empleado_codigo ? 'Confirmar recuperación' : 'Confirmar vínculo e importar'}</button>
        </div>
      </form>
    </div>}

    {data && <div className="panel">
      <PanelTitle title="Usuarios y marcaciones pendientes" subtitle="Sin importar indica eventos del equipo que no tienen una marcación aceptada en el sistema. Se consultan en el equipo, no se borran ni se modifican allí." />
      <div className="toolbar-grid">
        <input aria-label="Buscar usuario por ID, nombre o empleado" placeholder="Buscar ID, nombre o código…" value={search} onChange={event => setSearch(event.target.value)} />
        <label><input type="checkbox" checked={pendingOnly} onChange={event => setPendingOnly(event.target.checked)} /> Solo sin vínculo o con empleado por revisar</label>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>ID / Nombre en equipo</th><th>Empleado</th><th>Estado</th><th>Marcaciones / Sin importar</th><th>Última marcación</th><th>Acción</th></tr></thead>
        <tbody>{items.length ? items.map(user => <tr key={user.dispositivo_usuario_id}>
          <td>{user.dispositivo_usuario_id} — {user.nombre || 'Sin nombre'}</td>
          <td>{user.empleado_nombre || user.empleado_codigo || 'Sin asignar'}</td>
          <td>{user.estado === 'vinculado' ? 'Vinculado' : user.estado === 'sin_vincular' ? 'Pendiente de vínculo' : 'Empleado inactivo o inexistente'}</td>
          <td>{user.marcaciones} / {user.sin_importar}</td>
          <td>{formatDate(user.ultima_marcacion)}</td>
          <td><button type="button" className="outline-button" disabled={busy || user.estado === 'revisar_empleado'} onClick={() => selectUser(user)}>{user.empleado_codigo ? 'Recuperar marcaciones' : 'Vincular empleado'}</button></td>
        </tr>) : <tr><td colSpan="6">No hay usuarios que coincidan con el filtro.</td></tr>}</tbody>
      </table></div>
      <p>Los eventos excedentes de la jornada o rechazados por validaciones pueden permanecer sin importar. Revisa la bitácora; no se aceptan ni reasignan automáticamente.</p>
    </div>}
  </>;
}
