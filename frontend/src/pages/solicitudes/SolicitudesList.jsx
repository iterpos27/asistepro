import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, RotateCcw, X, FileUp, FileText } from 'lucide-react';
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
  sucursal_id: ''
};
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
  const canReview = user?.permisos?.solicitudes?.aprobar === true;
  const isEmployee = user?.rol === ROLES.EMPLEADO;
  
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
  }

  useEffect(() => {
    load();
    loadCatalogs().catch(() => {});
  }, [filters.estado, filters.tipo]);

  const visibleMarks = useMemo(() => 
    form.empleado_id ? marks.filter(mark => mark.empleado_id === form.empleado_id) : marks,
    [marks, form.empleado_id]
  );

  function change(field, value) {
    setForm(current => ({ ...current, [field]: value }));
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
        fecha_fin: form.fecha_fin,
        hora_inicio: form.hora_inicio || null,
        hora_fin: form.hora_fin || null,
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

      await solicitudService.createSolicitud(payload);
      toast.success('Solicitud registrada');
      setOpen(false);
      setForm(initialForm);
      setFileAttachment(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo registrar la solicitud');
    } finally {
      setSubmitting(false);
    }
  }

  async function review(item, decision) {
    const comentario = window.prompt(decision === 'aprobar' ? 'Comentario de aprobacion (opcional)' : 'Motivo del rechazo') || '';
    await solicitudService.reviewSolicitud(item.id, decision, comentario);
    toast.success(decision === 'aprobar' ? 'Solicitud aprobada' : 'Solicitud rechazada');
    await load();
  }

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
                    <select required value={form.empleado_id} onChange={e => change('empleado_id', e.target.value)}>
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
                <label>
                  Fecha inicio
                  <input required type="date" value={form.fecha_inicio} onChange={e => change('fecha_inicio', e.target.value)} />
                </label>
                <label>
                  Fecha fin
                  <input required type="date" value={form.fecha_fin} onChange={e => change('fecha_fin', e.target.value)} />
                </label>
                {!correction && (
                  <>
                    <label>Hora inicio<input type="time" value={form.hora_inicio} onChange={e => change('hora_inicio', e.target.value)} /></label>
                    <label>Hora fin<input type="time" value={form.hora_fin} onChange={e => change('hora_fin', e.target.value)} /></label>
                  </>
                )}
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
                {canReview && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map(item => (
                  <tr key={item.id}>
                    <td>{item.empleado_codigo} - {item.empleado_nombres} {item.empleado_apellidos}</td>
                    <td>{typeLabels[item.tipo]}</td>
                    <td>{String(item.fecha_inicio).slice(0, 10)} a {String(item.fecha_fin).slice(0, 10)}</td>
                    <td>{item.motivo}</td>
                    <td>
                      <span className={`status-pill ${item.estado === 'rechazada' ? 'danger' : item.estado === 'pendiente' ? 'warning' : ''}`}>{item.estado}</span>
                    </td>
                    <td>{item.comentario_revision || '-'}</td>
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
                    {canReview && (
                      <td>
                        <div className="row-actions">
                          {item.estado === 'pendiente' && (
                            <>
                              <button className="icon-button" aria-label="Aprobar" onClick={() => review(item, 'aprobar')}><Check size={16} /></button>
                              <button className="icon-button danger" aria-label="Rechazar" onClick={() => review(item, 'rechazar')}><X size={16}/></button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canReview ? 8 : 7}>No hay solicitudes.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
