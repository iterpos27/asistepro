import { useState, useEffect, useMemo } from 'react';
import { Check, Plus, RotateCcw, X, FileUp, FileText, Printer } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import { useAuthContext } from '../../context/AuthContext';
import { ROLES } from '../../utils/roles';
import * as solicitudService from '../../services/solicitudService';
import { toast } from '../../services/toastService';

const today = new Date().toISOString().slice(0, 10);
const initialForm = {
  empleado_id: '',
  tipo: 'vacaciones',
  fecha_inicio: today,
  fecha_fin: today,
  hora_inicio: '',
  hora_fin: '',
  motivo: '',
  accion: 'crear',
  marcacion_id: '',
  tipo_marcacion: 'entrada',
  marcado_en: '',
  sucursal_id: '',
  duracion_tipo: 'dias',
  destinatario: 'Unidad de Administración de Talento Humano',
  periodo: `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`,
  cedula: '',
  reemplazo_empleado_id: ''
};

const getDiasSolicitados = (inicio, fin) => {
  if (!inicio || !fin) return 0;
  const d1 = new Date(inicio + 'T00:00:00');
  const d2 = new Date(fin + 'T00:00:00');
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};

const getStatusClass = (status) => {
  switch (status) {
    case 'pendiente': return 'warning';
    case 'validada': return 'accent';
    case 'aprobada': return 'success';
    case 'rechazada': return 'danger';
    case 'cancelada': return 'muted';
    default: return '';
  }
};

const timeOptions = [];
for (let h = 0; h < 24; h++) {
  const hh = String(h).padStart(2, '0');
  timeOptions.push(`${hh}:00`);
  timeOptions.push(`${hh}:30`);
}
const typeLabels = {
  vacaciones: 'Vacaciones',
  permiso: 'Permiso',
  incapacidad: 'Incapacidad',
  ausencia: 'Ausencia',
  correccion_marcacion: 'Correccion de marcacion'
};

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

export default function SolicitudesList() {
  const { user } = useAuthContext();
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const canReview = user?.permisos?.solicitudes?.aprobar === true || Boolean(currentEmployee?.es_jefe);
  const isEmployee = user?.rol === ROLES.EMPLEADO;
  
  const canUserReview = (item) => {
    if (!canReview) return false;
    if (item.empleado_id === currentEmployee?.id) return false;
    
    const isJefe = user?.rol === ROLES.EMPLEADO && currentEmployee?.es_jefe;
    const isHR = user?.rol === ROLES.ADMIN_EMPRESA || user?.rol === ROLES.RRHH || user?.permisos?.solicitudes?.aprobar === true;
    
    if (isJefe) {
      return item.estado === 'pendiente';
    }
    
    if (isHR) {
      const isVacOrPermit = item.tipo === 'vacaciones' || item.tipo === 'permiso';
      if (isVacOrPermit) {
        return item.estado === 'validada';
      } else {
        return item.estado === 'pendiente' || item.estado === 'validada';
      }
    }
    
    return false;
  };
  
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [marks, setMarks] = useState([]);
  
  const [filters, setFilters] = useState({ estado: '', tipo: '' });
  const [form, setForm] = useState(initialForm);
  const [fileAttachment, setFileAttachment] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Custom states for printing and reviewing
  const [printItem, setPrintItem] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [reviewDecision, setReviewDecision] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  const [saldoAnterior, setSaldoAnterior] = useState('');
  const [saldoActual, setSaldoActual] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reemplazoEmpleadoId, setReemplazoEmpleadoId] = useState('');

  const correction = form.tipo === 'correccion_marcacion';

  async function load() {
    setLoading(true);
    try {
      const data = await solicitudService.listSolicitudes({ ...filters, limit: 100 });
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }

  async function loadCatalogs() {
    const data = await solicitudService.getCatalogs();
    setBranches(data.sucursales || []);
    setMarks(data.marcaciones || []);
    setEmployees(data.empleados || []);
    if (data.empleado_actual) {
      setCurrentEmployee(data.empleado_actual);
    }
  }

  useEffect(() => {
    load();
    loadCatalogs().catch(() => {});
  }, [filters.estado, filters.tipo]);

  // Autofill current logged-in employee when modal opens
  useEffect(() => {
    if (isEmployee && currentEmployee && open) {
      setForm(curr => ({
        ...curr,
        empleado_id: currentEmployee.id,
        cedula: currentEmployee.cedula || ''
      }));
    }
  }, [currentEmployee, isEmployee, open]);

  const visibleMarks = useMemo(() => 
    form.empleado_id ? marks.filter(mark => mark.empleado_id === form.empleado_id) : marks,
    [marks, form.empleado_id]
  );

  function change(field, value) {
    setForm(current => {
      const next = { ...current, [field]: value };
      if (field === 'duracion_tipo' && value === 'horas') {
        next.fecha_fin = next.fecha_inicio;
      }
      if (field === 'fecha_inicio' && next.duracion_tipo === 'horas') {
        next.fecha_fin = value;
      }
      return next;
    });
  }

  function handleFileChange(file) {
    if (!file) {
      setFileAttachment(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.warning('El comprobante debe ser PDF, JPG, PNG o WEBP');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.warning('El comprobante no puede superar 2MB');
      return;
    }
    setFileAttachment(file);
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        empleado_id: isEmployee ? undefined : form.empleado_id,
        tipo: form.tipo,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.duracion_tipo === 'horas' ? form.fecha_inicio : form.fecha_fin,
        hora_inicio: form.duracion_tipo === 'horas' && form.hora_inicio ? form.hora_inicio : null,
        hora_fin: form.duracion_tipo === 'horas' && form.hora_fin ? form.hora_fin : null,
        motivo: form.motivo
      };

      if (correction) {
        payload.datos_correccion = {
          accion: form.accion,
          marcacion_id: form.accion === 'crear' ? null : form.marcacion_id,
          tipo: form.accion === 'anular' ? null : form.tipo_marcacion,
          marcado_en: form.accion === 'anular' ? null : new Date(form.marcado_en).toISOString(),
          sucursal_id: form.accion === 'anular' ? null : form.sucursal_id
        };
      }

      if (fileAttachment) {
        const dataUrl = await toBase64(fileAttachment);
        payload.comprobante = {
          nombre: fileAttachment.name,
          tipo: fileAttachment.type,
          data_base64: dataUrl.split(',').pop(),
        };
      }

      if (form.tipo === 'vacaciones' || form.tipo === 'permiso') {
        payload.datos_adicionales = {
          destinatario: form.destinatario || 'Unidad de Administración de Talento Humano',
          periodo: form.periodo || '',
          cedula: form.cedula || '',
          reemplazo_empleado_id: form.reemplazo_empleado_id || null
        };
      }

      await solicitudService.createSolicitud(payload);
      toast.success('Solicitud registrada');
      setOpen(false);
      setForm(initialForm);
      setFileAttachment(null);
      await load();
    } catch (err) {
      const errorMsg = err.response?.data?.errors?.[0]?.mensaje || err.response?.data?.message || 'No se pudo registrar la solicitud';
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  }

  const startReviewApprove = (item) => {
    setReviewItem(item);
    setReviewDecision('aprobar');
    setReviewComment('');
    setSaldoAnterior('');
    setSaldoActual('');
    setReemplazoEmpleadoId('');
  };

  const startReviewReject = (item) => {
    setReviewItem(item);
    setReviewDecision('rechazar');
    setReviewComment('');
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewSubmitting(true);
    try {
      let datos_adicionales = null;
      if (reviewDecision === 'aprobar' && reviewItem.tipo === 'vacaciones' && user?.rol !== ROLES.EMPLEADO) {
        const otorgados = getDiasSolicitados(reviewItem.fecha_inicio, reviewItem.fecha_fin);
        datos_adicionales = {
          saldo_anterior: parseFloat(saldoAnterior) || 0,
          dias_otorgados: otorgados,
          saldo_actual: parseFloat(saldoActual) || 0
        };
      }
      await solicitudService.reviewSolicitud(reviewItem.id, reviewDecision, reviewComment, datos_adicionales, reemplazoEmpleadoId || null);
      
      const isJefe = user?.rol === ROLES.EMPLEADO;
      let successMsg = '';
      if (reviewDecision === 'aprobar') {
        successMsg = isJefe ? 'Solicitud validada y reemplazo designado' : 'Solicitud aprobada con éxito';
      } else {
        successMsg = 'Solicitud rechazada';
      }
      toast.success(successMsg);
      
      setReviewItem(null);
      await load();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'No se pudo procesar la revisión';
      toast.error(errorMsg);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handlePrint = (item) => {
    setPrintItem(item);
    setTimeout(() => {
      window.print();
      setPrintItem(null);
    }, 150);
  };

  return (
    <>
      <PageHeader
        title="Solicitudes y aprobaciones"
        description="Vacaciones, permisos, ausencias y correcciones con trazabilidad."
        actions={
          <button className="primary-button compact" onClick={() => { setForm(initialForm); setFileAttachment(null); setOpen(true); }}>
            <Plus size={16} />Nueva solicitud
          </button>
        }
      />
      
      <div className="panel">
        <PanelTitle title="Filtros" />
        <div className="toolbar-grid">
          <select value={filters.estado} onChange={e => setFilters({ ...filters, estado: e.target.value })}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="cancelada">Canceladas</option>
          </select>
          <select value={filters.tipo} onChange={e => setFilters({ ...filters, tipo: e.target.value })}>
            <option value="">Todos los tipos</option>
            {Object.entries(typeLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button className="outline-button" onClick={load}>
            <RotateCcw size={16} />Aplicar
          </button>
        </div>
      </div>
      
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <PanelTitle title="Nueva solicitud" subtitle="La solicitud quedara pendiente de revision" />
            <form className="module-form" onSubmit={submit}>
              <div className="form-grid">
                {!isEmployee && (
                  <label>
                    Empleado
                    <select required value={form.empleado_id} onChange={e => {
                      const empId = e.target.value;
                      change('empleado_id', empId);
                      const emp = employees.find(item => item.id === empId);
                      if (emp) {
                        change('cedula', emp.cedula || '');
                      } else {
                        change('cedula', '');
                      }
                    }}>
                      <option value="">Seleccionar</option>
                      {employees.map(item => (
                        <option key={item.id} value={item.id}>{item.codigo} - {item.nombres} {item.apellidos}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Tipo
                  <select value={form.tipo} onChange={e => change('tipo', e.target.value)}>
                    {Object.entries(typeLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
                {(form.tipo === 'vacaciones' || form.tipo === 'permiso') && (
                  <>
                    <label>
                      Cédula / C.I.
                      <input 
                        required 
                        type="text" 
                        value={form.cedula || ''} 
                        onChange={e => change('cedula', e.target.value)} 
                        placeholder="Ej. 1312345678" 
                        maxLength={20}
                      />
                    </label>
                    <label>
                      Destinatario
                      <input 
                        required 
                        type="text" 
                        value={form.destinatario || ''} 
                        onChange={e => change('destinatario', e.target.value)} 
                        placeholder="Ej. Unidad de Talento Humano" 
                      />
                    </label>
                    <label>
                      Período Correspondiente
                      <input 
                        required 
                        type="text" 
                        value={form.periodo || ''} 
                        onChange={e => change('periodo', e.target.value)} 
                        placeholder="Ej. 2025-2026" 
                      />
                    </label>
                    <label>
                      Empleado Reemplazo
                      <select 
                        value={form.reemplazo_empleado_id || ''} 
                        onChange={e => change('reemplazo_empleado_id', e.target.value)}
                      >
                        <option value="">Ninguno</option>
                        {employees
                          .filter(emp => emp.id !== form.empleado_id)
                          .map(item => (
                            <option key={item.id} value={item.id}>
                              {item.codigo} - {item.nombres} {item.apellidos}
                            </option>
                          ))}
                      </select>
                    </label>
                  </>
                )}
                {!correction && (
                  <label>
                    Duración
                    <select value={form.duracion_tipo || 'dias'} onChange={e => change('duracion_tipo', e.target.value)}>
                      <option value="dias">Por días (Día completo)</option>
                      <option value="horas">Por horas</option>
                    </select>
                  </label>
                )}
                {(!correction && form.duracion_tipo === 'horas') ? (
                  <>
                    <label>
                      Fecha
                      <input required type="date" value={form.fecha_inicio} onChange={e => change('fecha_inicio', e.target.value)} />
                    </label>
                    <label>
                      Hora inicio
                      <select required value={form.hora_inicio || ''} onChange={e => change('hora_inicio', e.target.value)}>
                        <option value="">Seleccionar hora</option>
                        {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                    <label>
                      Hora fin
                      <select required value={form.hora_fin || ''} onChange={e => change('hora_fin', e.target.value)}>
                        <option value="">Seleccionar hora</option>
                        {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                  </>
                ) : !correction ? (
                  <>
                    <label>
                      Fecha inicio
                      <input required type="date" value={form.fecha_inicio} onChange={e => change('fecha_inicio', e.target.value)} />
                    </label>
                    <label>
                      Fecha fin
                      <input required type="date" value={form.fecha_fin} onChange={e => change('fecha_fin', e.target.value)} />
                    </label>
                  </>
                ) : null}
                {correction && (
                  <>
                    <label>
                      Accion
                      <select value={form.accion} onChange={e => change('accion', e.target.value)}>
                        <option value="crear">Crear faltante</option>
                        <option value="editar">Corregir existente</option>
                        <option value="anular">Anular existente</option>
                      </select>
                    </label>
                    {form.accion !== 'crear' && (
                      <label>
                        Marcacion
                        <select required value={form.marcacion_id} onChange={e => change('marcacion_id', e.target.value)}>
                          <option value="">Seleccionar</option>
                          {visibleMarks.map(item => (
                            <option key={item.id} value={item.id}>{new Date(item.marcado_en).toLocaleString()} - {item.tipo}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {form.accion !== 'anular' && (
                      <>
                        <label>
                          Tipo de marcacion
                          <select value={form.tipo_marcacion} onChange={e => change('tipo_marcacion', e.target.value)}>
                            <option value="entrada">Entrada</option>
                            <option value="salida">Salida</option>
                          </select>
                        </label>
                        <label>
                          Fecha y hora
                          <input required type="datetime-local" value={form.marcado_en} onChange={e => change('marcado_en', e.target.value)} />
                        </label>
                        <label>
                          Sucursal
                          <select required value={form.sucursal_id} onChange={e => change('sucursal_id', e.target.value)}>
                            <option value="">Seleccionar</option>
                            {branches.map(item => (
                              <option key={item.id} value={item.id}>{item.nombre}</option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                  </>
                )}
                <label className="wide-field">
                  Motivo
                  <textarea required value={form.motivo} onChange={e => change('motivo', e.target.value)} placeholder="Describe el motivo y la evidencia disponible" />
                </label>
                
                <label className="wide-field file-uploader-box">
                  Documento / Comprobante adjunto (opcional)
                  <div className="uploader-area-dashed" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer', background: '#f8fafc', position: 'relative' }}>
                    <FileUp size={24} style={{ color: '#64748b', marginBottom: '8px' }} />
                    <input 
                      type="file" 
                      accept="application/pdf,image/png,image/jpeg,image/webp" 
                      onChange={(event) => handleFileChange(event.target.files?.[0])}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                    {fileAttachment ? (
                      <div style={{ textAlign: 'center' }}>
                        <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a' }}>{fileAttachment.name}</strong>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{(fileAttachment.size / 1024).toFixed(1)} KB · Cambiar archivo</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>Haz clic para seleccionar el archivo (PDF, JPG, PNG o WEBP de hasta 2MB)</span>
                    )}
                  </div>
                </label>
              </div>
              <div className="form-actions">
                <button type="button" className="outline-button" onClick={() => setOpen(false)} disabled={submitting}>Cancelar</button>
                <button className="primary-button compact" disabled={submitting}>
                  {submitting ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <div className="panel">
        <PanelTitle title="Solicitudes registradas" subtitle={loading ? 'Cargando...' : `${items.length} registros`} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Tipo</th>
                <th>Periodo</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th>Revision</th>
                <th>Adjunto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map(item => (
                  <tr key={item.id}>
                    <td>{item.empleado_codigo} - {item.empleado_nombres} {item.empleado_apellidos}</td>
                    <td>{typeLabels[item.tipo]}</td>
                    <td>
                      {String(item.fecha_inicio).slice(0, 10)}
                      {item.hora_inicio ? ` (${String(item.hora_inicio).slice(0, 5)} - ${String(item.hora_fin).slice(0, 5)})` : ` a ${String(item.fecha_fin).slice(0, 10)}`}
                    </td>
                    <td>{item.motivo}</td>
                    <td>
                      <span className={`status-pill ${getStatusClass(item.estado)}`}>{item.estado}</span>
                    </td>
                    <td>
                      {item.validador_nombre && (
                        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ color: '#0284c7', fontWeight: '700' }}>[Validado]</span> por {item.validador_nombre}
                          {item.reemplazo_nombres && <span style={{ display: 'block', color: '#475569', fontSize: '11px', fontWeight: '600' }}>Reemplazo: {item.reemplazo_nombres} {item.reemplazo_apellidos}</span>}
                          {item.comentario_validacion && <span style={{ display: 'block', fontStyle: 'italic', color: '#64748b' }}>"{item.comentario_validacion}"</span>}
                        </div>
                      )}
                      {item.revisor_nombre && (
                        <div style={{ fontSize: '12px' }}>
                          <span style={{ color: '#16a34a', fontWeight: '700' }}>[Aprobado]</span> por {item.revisor_nombre}
                          {item.comentario_revision && <span style={{ display: 'block', fontStyle: 'italic', color: '#64748b' }}>"{item.comentario_revision}"</span>}
                        </div>
                      )}
                      {!item.validador_nombre && !item.revisor_nombre && '-'}
                    </td>
                    <td>
                      {item.comprobante_storage_url ? (
                        <a href={item.comprobante_storage_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: '700', textDecoration: 'none' }} title="Descargar/Ver archivo adjunto">
                          <FileText size={15} />
                          Ver adjunto
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {canUserReview(item) && (
                          <>
                            <button 
                              className="icon-button" 
                              title={user?.rol === ROLES.EMPLEADO ? "Validar y Designar Reemplazo" : "Aprobar finalmente"} 
                              onClick={() => startReviewApprove(item)}
                            >
                              <Check size={16} />
                            </button>
                            <button 
                              className="icon-button danger" 
                              title="Rechazar" 
                              onClick={() => startReviewReject(item)}
                            >
                              <X size={16}/>
                            </button>
                          </>
                        )}
                        {item.estado === 'aprobada' && (
                          <button 
                            className="icon-button" 
                            title="Imprimir solicitud (PDF)" 
                            onClick={() => handlePrint(item)}
                            style={{ color: '#1e3a8a' }}
                          >
                            <Printer size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>No hay solicitudes.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {reviewItem && (
        <div className="modal-backdrop" onClick={() => setReviewItem(null)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <PanelTitle 
              title={reviewDecision === 'aprobar' ? 'Aprobar Solicitud' : 'Rechazar Solicitud'} 
              subtitle={`Solicitante: ${reviewItem.empleado_nombres} ${reviewItem.empleado_apellidos}`} 
            />
            <form className="module-form" onSubmit={handleReviewSubmit}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: '16px' }}>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '13px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: '0 0 6px 0' }}><strong>Tipo:</strong> {typeLabels[reviewItem.tipo]}</p>
                  <p style={{ margin: '0 0 6px 0' }}>
                    <strong>Fechas:</strong> {reviewItem.fecha_inicio} a {reviewItem.fecha_fin} 
                    ({getDiasSolicitados(reviewItem.fecha_inicio, reviewItem.fecha_fin)} días)
                  </p>
                  {reviewItem.reemplazo_nombres && (
                    <p style={{ margin: '0 0 6px 0' }}>
                      <strong>Reemplazo designado:</strong> {reviewItem.reemplazo_nombres} {reviewItem.reemplazo_apellidos}
                    </p>
                  )}
                  <p style={{ margin: 0 }}><strong>Motivo:</strong> {reviewItem.motivo}</p>
                </div>

                {reviewDecision === 'aprobar' && user?.rol === ROLES.EMPLEADO && (reviewItem.tipo === 'vacaciones' || reviewItem.tipo === 'permiso') && (
                  <label style={{ margin: 0 }}>
                    Designar Empleado de Reemplazo (Obligatorio)
                    <select 
                      required 
                      value={reemplazoEmpleadoId} 
                      onChange={e => setReemplazoEmpleadoId(e.target.value)}
                    >
                      <option value="">Selecciona un empleado de reemplazo...</option>
                      {employees
                        .filter(emp => emp.id !== reviewItem.empleado_id)
                        .map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.nombres} {emp.apellidos} ({emp.codigo})
                          </option>
                        ))}
                    </select>
                  </label>
                )}

                {reviewDecision === 'aprobar' && user?.rol !== ROLES.EMPLEADO && reviewItem.tipo === 'vacaciones' && (
                  <div style={{ border: '1px solid #cbd5e1', padding: '14px', borderRadius: '8px', background: '#f0fdf4' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#166534', fontWeight: '700' }}>Control de Saldos (Talento Humano)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <label style={{ margin: 0 }}>
                        Saldo Anterior (días)
                        <input 
                          required 
                          type="number" 
                          step="0.5" 
                          min="0" 
                          value={saldoAnterior} 
                          onChange={e => {
                            setSaldoAnterior(e.target.value);
                            const prev = parseFloat(e.target.value);
                            if (!isNaN(prev)) {
                              const reqDays = getDiasSolicitados(reviewItem.fecha_inicio, reviewItem.fecha_fin);
                              setSaldoActual(Math.max(0, prev - reqDays));
                            }
                          }} 
                          placeholder="Ej. 15" 
                        />
                      </label>
                      <label style={{ margin: 0 }}>
                        Días Otorgados
                        <input 
                          readOnly 
                          type="number" 
                          value={getDiasSolicitados(reviewItem.fecha_inicio, reviewItem.fecha_fin)} 
                          style={{ background: '#e2e8f0', cursor: 'not-allowed' }}
                        />
                      </label>
                      <label style={{ margin: '0', gridColumn: 'span 2' }}>
                        Saldo Actual (días)
                        <input 
                          required 
                          type="number" 
                          step="0.5" 
                          min="0" 
                          value={saldoActual} 
                          onChange={e => setSaldoActual(e.target.value)} 
                          placeholder="Ej. 10" 
                        />
                      </label>
                    </div>
                  </div>
                )}

                <label style={{ margin: 0 }}>
                  {reviewDecision === 'aprobar' ? 'Comentario de aprobación (opcional)' : 'Motivo del rechazo'}
                  <textarea 
                    required={reviewDecision === 'rechazar'} 
                    value={reviewComment} 
                    onChange={e => setReviewComment(e.target.value)} 
                    placeholder={reviewDecision === 'aprobar' ? 'Ingresa comentarios u observaciones' : 'Ingresa la razón del rechazo'} 
                    style={{ minHeight: '80px' }}
                  />
                </label>
              </div>

              <div className="form-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="outline-button" onClick={() => setReviewItem(null)} disabled={reviewSubmitting}>Cancelar</button>
                <button 
                  className={`primary-button compact ${reviewDecision === 'rechazar' ? 'danger' : ''}`} 
                  disabled={reviewSubmitting}
                >
                  {reviewSubmitting ? 'Procesando...' : reviewDecision === 'aprobar' ? 'Aprobar' : 'Rechazar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden Print Template */}
      {printItem && (
        <div className="print-document-container">
          <div className="print-card">
            <div className="print-header">
              <div className="print-logo-box">
                <div className="print-company-title">ASISTEPRO - SISTEMA DE CONTROL DE ASISTENCIA Y PERSONAL</div>
              </div>
              <div className="print-form-id">F-TH-02</div>
            </div>
            
            <div className="print-title-box">
              <h2>FORMULARIO DE SOLICITUD DE VACACIONES Y LICENCIAS</h2>
              <div className="print-date">Portoviejo, {new Date(printItem.creado_en).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            </div>

            <table className="print-meta-table">
              <tbody>
                <tr>
                  <td className="print-lbl"><strong>PARA:</strong></td>
                  <td>{printItem.datos_adicionales?.destinatario || 'Unidad de Administración de Talento Humano'}</td>
                </tr>
                <tr>
                  <td className="print-lbl"><strong>DE:</strong></td>
                  <td>{printItem.empleado_nombres} {printItem.empleado_apellidos}</td>
                </tr>
              </tbody>
            </table>

            <h3 className="print-section-title">1. DATOS GENERALES DEL SERVIDOR</h3>
            <table className="print-info-table">
              <tbody>
                <tr>
                  <th>Cédula / C.I.</th>
                  <td>{printItem.datos_adicionales?.cedula || printItem.empleado_cedula || '-'}</td>
                  <th>Sucursal / Unidad</th>
                  <td>{printItem.empleado_sucursal || 'Matriz'}</td>
                </tr>
                <tr>
                  <th>Cargo</th>
                  <td>{printItem.empleado_cargo || '-'}</td>
                  <th>Departamento</th>
                  <td>{printItem.empleado_departamento || '-'}</td>
                </tr>
              </tbody>
            </table>

            <h3 className="print-section-title">2. DETALLE DE LA SOLICITUD</h3>
            <table className="print-info-table">
              <tbody>
                <tr>
                  <th>Tipo de Trámite</th>
                  <td>{typeLabels[printItem.tipo] || printItem.tipo}</td>
                  <th>Período Correspondiente</th>
                  <td>{printItem.datos_adicionales?.periodo || '-'}</td>
                </tr>
                <tr>
                  <th>Fecha de Salida</th>
                  <td>{new Date(printItem.fecha_inicio + 'T00:00:00').toLocaleDateString('es-EC')}</td>
                  <th>Fecha de Retorno</th>
                  <td>{new Date(printItem.fecha_fin + 'T00:00:00').toLocaleDateString('es-EC')}</td>
                </tr>
                <tr>
                  <th>Duración Solicitada</th>
                  <td colSpan={3}>
                    {getDiasSolicitados(printItem.fecha_inicio, printItem.fecha_fin)} día(s)
                    {printItem.hora_inicio && ` (Por horas: ${printItem.hora_inicio} - ${printItem.hora_fin})`}
                  </td>
                </tr>
                <tr>
                  <th>Motivo / Justificación</th>
                  <td colSpan={3}>{printItem.motivo}</td>
                </tr>
              </tbody>
            </table>

            {printItem.datos_adicionales?.reemplazo_empleado_id && (() => {
              const replacement = employees.find(emp => emp.id === printItem.datos_adicionales.reemplazo_empleado_id);
              if (!replacement) return null;
              return (
                <>
                  <h3 className="print-section-title">3. DESIGNACIÓN DE REEMPLAZO</h3>
                  <div className="print-reemplazo-box">
                    Por medio de la presente, se deja constancia que el/la servidor/a <strong>{replacement.nombres} {replacement.apellidos}</strong> con C.I. <strong>{replacement.cedula || '-'}</strong> asumirá las funciones inherentes a mi puesto durante el período antes detallado.
                  </div>
                </>
              );
            })()}

            {printItem.tipo === 'vacaciones' && printItem.datos_adicionales?.saldo_anterior !== undefined && (
              <>
                <h3 className="print-section-title">4. CONTROL DE VACACIONES - TALENTO HUMANO (Uso Interno)</h3>
                <table className="print-ledger-table">
                  <thead>
                    <tr>
                      <th>Saldo de Vacaciones Anterior</th>
                      <th>Días Otorgados en esta Solicitud</th>
                      <th>Saldo de Vacaciones Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{printItem.datos_adicionales.saldo_anterior} día(s)</td>
                      <td>{printItem.datos_adicionales.dias_otorgados} día(s)</td>
                      <td>{printItem.datos_adicionales.saldo_actual} día(s)</td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            <h3 className="print-section-title">5. FIRMAS DE RESPONSABILIDAD Y APROBACIÓN</h3>
            <div className="print-signatures-grid">
              <div className="print-signature-card">
                <div className="print-sig-space">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=ASISTEPRO-VALIDACION-SOLICITANTE-${printItem.id}-${printItem.datos_adicionales?.cedula || printItem.empleado_cedula}`} 
                    alt="QR" 
                    className="print-qr-img" 
                  />
                  <div className="print-sig-status">FIRMADO DIGITALMENTE</div>
                </div>
                <div className="print-sig-name">{printItem.empleado_nombres} {printItem.empleado_apellidos}</div>
                <div className="print-sig-title">C.I.: {printItem.datos_adicionales?.cedula || printItem.empleado_cedula || '-'}</div>
                <div className="print-sig-role">SOLICITANTE</div>
              </div>

              <div className="print-signature-card">
                <div className="print-sig-space">
                  <div className="print-stamp aprobado">APROBADO</div>
                  <div className="print-sig-status">APROBADO POR SISTEMA</div>
                  <div className="print-sig-date">{printItem.revisado_en ? new Date(printItem.revisado_en).toLocaleString('es-EC') : '-'}</div>
                </div>
                <div className="print-sig-name">{printItem.revisor_nombre || 'Jefe Inmediato'}</div>
                <div className="print-sig-title">Validación Electrónica</div>
                <div className="print-sig-role">JEFE INMEDIATO</div>
              </div>

              <div className="print-signature-card">
                <div className="print-sig-space">
                  <div className="print-stamp registrado">REGISTRADO</div>
                  <div className="print-sig-status">APROBADO POR SISTEMA</div>
                  <div className="print-sig-date">{printItem.revisado_en ? new Date(printItem.revisado_en).toLocaleString('es-EC') : '-'}</div>
                </div>
                <div className="print-sig-name">Talento Humano</div>
                <div className="print-sig-title">Validación Electrónica</div>
                <div className="print-sig-role">TALENTO HUMANO</div>
              </div>
            </div>
            
            <div className="print-footer-note">
              Este documento cuenta con validez legal electrónica bajo el amparo de la Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos de la República del Ecuador.
            </div>
          </div>
        </div>
      )}

      <style>{`
        .print-document-container {
          width: 100%;
          color: #000;
          background: #fff;
          font-family: 'Inter', Arial, sans-serif;
        }
        .print-card {
          max-width: 800px;
          margin: 0 auto;
          padding: 10px;
        }
        .print-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .print-logo-box {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .print-company-title {
          font-size: 14px;
          font-weight: 800;
          line-height: 1.2;
          max-width: 500px;
          text-transform: uppercase;
        }
        .print-form-id {
          font-size: 12px;
          font-weight: 700;
          border: 1px solid #000;
          padding: 4px 8px;
        }
        .print-title-box {
          text-align: center;
          margin-bottom: 20px;
        }
        .print-title-box h2 {
          font-size: 16px;
          font-weight: 800;
          margin: 0 0 5px 0;
          text-transform: uppercase;
        }
        .print-date {
          font-size: 12px;
          color: #333;
        }
        .print-meta-table {
          width: 100%;
          margin-bottom: 20px;
          border-collapse: collapse;
        }
        .print-meta-table td {
          padding: 6px 0;
          font-size: 13px;
        }
        .print-lbl {
          width: 120px;
        }
        .print-section-title {
          font-size: 12px;
          font-weight: 800;
          background: #f1f5f9;
          padding: 6px 10px;
          margin: 15px 0 10px 0;
          border-left: 4px solid #000;
          text-transform: uppercase;
        }
        .print-info-table, .print-ledger-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }
        .print-info-table th, .print-info-table td, .print-ledger-table th, .print-ledger-table td {
          border: 1px solid #cbd5e1;
          padding: 8px 10px;
          font-size: 12px;
          text-align: left;
        }
        .print-info-table th {
          background: #f8fafc;
          font-weight: 700;
          width: 150px;
        }
        .print-reemplazo-box {
          font-size: 12px;
          line-height: 1.5;
          padding: 10px;
          border: 1px dashed #cbd5e1;
          background: #f8fafc;
          border-radius: 4px;
        }
        .print-ledger-table th {
          background: #f8fafc;
          font-weight: 700;
          text-align: center;
        }
        .print-ledger-table td {
          text-align: center;
          font-size: 14px;
          font-weight: 700;
        }
        .print-signatures-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-top: 20px;
        }
        .print-signature-card {
          border: 1px solid #cbd5e1;
          padding: 15px 10px;
          text-align: center;
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          min-height: 180px;
        }
        .print-sig-space {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
          width: 100%;
        }
        .print-qr-img {
          width: 80px;
          height: 80px;
          margin-bottom: 5px;
        }
        .print-sig-status {
          font-size: 9px;
          color: #475569;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .print-sig-date {
          font-size: 9px;
          color: #64748b;
          margin-top: 2px;
        }
        .print-stamp {
          font-size: 12px;
          font-weight: 900;
          border: 2px double;
          padding: 4px 10px;
          transform: rotate(-10deg);
          border-radius: 4px;
          margin-bottom: 8px;
          display: inline-block;
        }
        .print-stamp.aprobado {
          color: #15803d;
          border-color: #15803d;
        }
        .print-stamp.registrado {
          color: #1d4ed8;
          border-color: #1d4ed8;
        }
        .print-sig-name {
          font-size: 11px;
          font-weight: 700;
          border-top: 1px solid #e2e8f0;
          padding-top: 5px;
          width: 90%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .print-sig-title {
          font-size: 9px;
          color: #64748b;
        }
        .print-sig-role {
          font-size: 10px;
          font-weight: 800;
          color: #0f172a;
          margin-top: 2px;
        }
        .print-footer-note {
          font-size: 10px;
          color: #64748b;
          text-align: center;
          margin-top: 25px;
          line-height: 1.4;
          border-top: 1px solid #e2e8f0;
          padding-top: 10px;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }
          .print-document-container, .print-document-container * {
            visibility: visible !important;
          }
          .print-document-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
          }
        }
        @media screen {
          .print-document-container {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
