import { useEffect, useState } from 'react';
import { Building2, Download, Eye, RotateCcw, Search } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import * as service from '../../services/auditoriaService';
import * as empresaService from '../../services/empresaService';

const FIELD_LABELS = {
  nombres: 'Nombres', apellidos: 'Apellidos', apellido: 'Apellido', nombre: 'Nombre',
  email: 'Correo Electrónico', rol: 'Rol de Usuario', tipo: 'Tipo de Evento',
  latitud: 'Latitud', longitud: 'Longitud', accuracy: 'Precisión GPS',
  precision_gps: 'Precisión GPS', motivo_novedad: 'Motivo de Novedad',
  detalle_novedad: 'Detalle de Novedad', marcado_en: 'Fecha de Marcación',
  monto: 'Monto / Valor', descripcion: 'Descripción', estado: 'Estado',
  fecha: 'Fecha', fecha_desde: 'Fecha Desde', fecha_hasta: 'Fecha Hasta',
  fecha_inicio: 'Fecha de Inicio', fecha_fin: 'Fecha de Fin',
  hora_inicio: 'Hora de Inicio', hora_fin: 'Hora de Fin', motivo: 'Motivo',
  observaciones: 'Observaciones', direccion: 'Dirección', telefono: 'Teléfono',
  identificacion: 'Identificación / Cédula', cedula: 'Cédula', activo: 'Activo',
  razon_social: 'Razón Social', ruc: 'RUC / Identificación Fiscal',
  plan_id: 'Plan Contratado', limite_empleados: 'Límite de Empleados',
  precio_mensual: 'Precio Mensual', periodo: 'Período', comprobante: 'Comprobante',
  comprobante_url: 'Archivo de Comprobante',
};

function FriendlyMetadata({ metadata }) {
  if (!metadata) return <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '12px 0' }}>No hay detalles adicionales.</p>;
  const fields = {};
  if (metadata.body && typeof metadata.body === 'object') Object.assign(fields, metadata.body);
  if (metadata.query && typeof metadata.query === 'object') Object.assign(fields, metadata.query);
  if (metadata.params && typeof metadata.params === 'object') Object.assign(fields, metadata.params);
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const visibleFields = Object.entries(fields).filter(([key, value]) => {
    if (value === null || value === undefined || value === '') return false;
    if (key === 'actor') return false;
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('id') || lowerKey.includes('uuid') || lowerKey.includes('token') ||
        lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('salt') || lowerKey.includes('hash')) return false;
    if (typeof value === 'string' && UUID_REGEX.test(value)) return false;
    return true;
  });
  if (visibleFields.length === 0) return <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '12px 0' }}>Sin datos modificados detallados.</p>;
  return (
    <div style={{ marginTop: '16px' }}>
      <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600', color: 'var(--text-color)' }}>Datos Registrados de la Operación:</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', maxHeight: '200px', overflowY: 'auto' }}>
        {visibleFields.map(([key, value]) => {
          const label = FIELD_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
          let displayValue = String(value);
          if (typeof value === 'boolean') displayValue = value ? 'Sí' : 'No';
          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b', wordBreak: 'break-word' }}>{displayValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Auditoria() {
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState('');
  const [filters, setFilters] = useState({ search: '', entidad: '', fecha_desde: '', fecha_hasta: '' });
  const [data, setData] = useState({ items: [], total: 0 });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    empresaService.listEmpresas({ limit: 200 }).then((result) => {
      setEmpresas(result?.items || result || []);
    }).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = { ...filters, limit: 100 };
      if (empresaId) params.empresa_id = empresaId;
      setData(await service.listAuditoria(params));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [empresaId]);

  function change(field, value) { setFilters((current) => ({ ...current, [field]: value })); }

  const selectedEmpresa = empresas.find((e) => e.id === empresaId);

  return (
    <>
      <PageHeader
        title="Auditoría del Sistema"
        description="Trazabilidad completa de cambios por empresa, actor, módulo y datos modificados."
        actions={
          <button className="outline-button" onClick={() => service.exportarAuditoria({ ...filters, empresa_id: empresaId || undefined })}>
            <Download size={16} /> Exportar CSV
          </button>
        }
      />

      {/* Company selector */}
      <div className="panel" style={{ marginBottom: '1rem' }}>
        <PanelTitle title="Empresa" subtitle="Selecciona la empresa para ver su auditoría" />
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Building2 size={20} style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            style={{ flex: 1, minWidth: '240px', maxWidth: '400px' }}
            id="empresa-selector-auditoria"
          >
            <option value="">— Todas las empresas —</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.razon_social || e.nombre}</option>
            ))}
          </select>
          {selectedEmpresa && (
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              RUC: {selectedEmpresa.ruc || 'N/D'}
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="panel">
        <PanelTitle title="Filtros" subtitle="Consulta eventos administrativos y operativos" />
        <div className="toolbar-grid">
          <label className="search-box inline-search">
            <Search size={16} />
            <input value={filters.search} onChange={(e) => change('search', e.target.value)} placeholder="Usuario o acción..." />
          </label>
          <input placeholder="Entidad (ej: empleados)" value={filters.entidad} onChange={(e) => change('entidad', e.target.value)} />
          <input type="date" value={filters.fecha_desde} onChange={(e) => change('fecha_desde', e.target.value)} />
          <input type="date" value={filters.fecha_hasta} onChange={(e) => change('fecha_hasta', e.target.value)} />
          <button className="outline-button" onClick={load}><RotateCcw size={16} /> Aplicar</button>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <PanelTitle title="Detalle de auditoría" subtitle={selected.ruta} />
            <div className="settings-grid">
              <label>Usuario <input readOnly value={selected.usuario_email || 'Sistema'} /></label>
              <label>Estado
                <span className={`status-pill ${selected.estado_http >= 400 ? 'danger' : ''}`} style={{ display: 'inline-block', marginTop: '6px', textAlign: 'center' }}>
                  {selected.estado_http >= 400 ? 'Fallido' : 'Exitoso'}
                </span>
              </label>
              <label>Fecha <input readOnly value={new Date(selected.creado_en).toLocaleString()} /></label>
            </div>
            <FriendlyMetadata metadata={selected.metadata} />
            <div className="form-actions" style={{ marginTop: '20px' }}>
              <button className="outline-button" onClick={() => setSelected(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Events table */}
      <div className="panel">
        <PanelTitle title="Eventos registrados" subtitle={loading ? 'Cargando...' : `${data.total || 0} eventos`} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Módulo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items?.length ? data.items.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.creado_en).toLocaleString()}</td>
                  <td>{item.usuario_email || 'Sistema'}</td>
                  <td>{item.accion}</td>
                  <td>{item.ruta}</td>
                  <td><span className={`status-pill ${item.estado_http >= 400 ? 'danger' : ''}`}>{item.estado_http >= 400 ? 'Fallido' : 'Exitoso'}</span></td>
                  <td><button className="icon-button" aria-label="Ver detalle" onClick={() => setSelected(item)}><Eye size={16} /></button></td>
                </tr>
              )) : (
                <tr><td colSpan="6" style={{ textAlign: 'center' }}>{loading ? 'Cargando...' : 'No hay eventos para mostrar.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
