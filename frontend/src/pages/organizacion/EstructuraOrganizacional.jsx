import { useEffect, useMemo, useState } from 'react';
import { Building2, Download, FileSpreadsheet, Plus, Save, ShieldCheck, Trash2, Upload } from 'lucide-react';
import MetricCard from '../../components/cards/MetricCard';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import { toast } from '../../services/toastService';
import * as organizacionService from '../../services/organizacionService';

const initialForm = {
  tipo: 'departamento',
  codigo: '',
  nombre: '',
  descripcion: '',
  parent_id: '',
  responsable_empleado_id: '',
};

function formatJson(value) {
  return JSON.stringify(value || {}, null, 2);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function EstructuraOrganizacional() {
  const [summary, setSummary] = useState(null);
  const [catalogs, setCatalogs] = useState({ estructuras: [], supervisores: [], sucursales: [] });
  const [structures, setStructures] = useState([]);
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(initialForm);
  const [selectedFile, setSelectedFile] = useState(null);

  const structureOptions = useMemo(
    () => structures.filter((item) => item.tipo !== 'cargo' && item.tipo !== 'centro_costo'),
    [structures],
  );

  async function loadData() {
    setLoading(true);
    try {
      const [summaryResult, catalogsResult, structuresResult, importsResult] = await Promise.all([
        organizacionService.getSummary(),
        organizacionService.getCatalogs(),
        organizacionService.listStructures({ activo: true }),
        organizacionService.listImports(),
      ]);
      setSummary(summaryResult);
      setCatalogs(catalogsResult);
      setStructures(structuresResult || []);
      setImports(importsResult || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setSelectedId('');
    setForm(initialForm);
  }

  function startEdit(item) {
    setSelectedId(item.id);
    setForm({
      tipo: item.tipo,
      codigo: item.codigo,
      nombre: item.nombre,
      descripcion: item.descripcion || '',
      parent_id: item.parent_id || '',
      responsable_empleado_id: item.responsable_empleado_id || '',
    });
  }

  async function saveStructure(event) {
    event.preventDefault();
    setSaving(true);
    try {
      if (selectedId) {
        await organizacionService.updateStructure(selectedId, form);
        toast.success('Estructura actualizada');
      } else {
        await organizacionService.createStructure(form);
        toast.success('Estructura creada');
      }
      resetForm();
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function removeStructure(id) {
    await organizacionService.deleteStructure(id);
    toast.success('Estructura desactivada');
    if (selectedId === id) resetForm();
    await loadData();
  }

  async function handleImport() {
    if (!selectedFile) {
      toast.warning('Selecciona un archivo Excel');
      return;
    }
    setSaving(true);
    try {
      const archivo_base64 = await readFileAsDataUrl(selectedFile);
      await organizacionService.importEmployees({
        nombre_archivo: selectedFile.name,
        archivo_base64,
      });
      toast.success('Importacion procesada');
      setSelectedFile(null);
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Estructura organizacional"
        description="Areas, cargos, centros de costo y carga masiva de empleados por Excel."
        actions={<span className="status-pill">{loading ? 'Cargando' : `${structures.length} estructuras activas`}</span>}
      />

      <section className="metrics-grid">
        <MetricCard label="Empleados activos" value={summary?.empleados_activos || 0} icon={Building2} />
        <MetricCard label="Con acceso" value={summary?.empleados_con_usuario || 0} icon={ShieldCheck} tone="success" />
        <MetricCard label="Importaciones del mes" value={summary?.importaciones_mes || 0} icon={FileSpreadsheet} tone="accent" />
        <MetricCard label="Errores del mes" value={summary?.errores_mes || 0} icon={Upload} tone="warning" />
      </section>

      <div className="dashboard-split">
        <div className="panel">
          <PanelTitle
            title={selectedId ? 'Editar estructura' : 'Nueva estructura'}
            subtitle="Define la jerarquia organizacional que usaran empleados, reportes e integraciones."
          />
          <form className="stack-form" onSubmit={saveStructure}>
            <div className="toolbar-grid">
              <select value={form.tipo} onChange={(event) => setForm((current) => ({ ...current, tipo: event.target.value }))}>
                <option value="direccion">Direccion</option>
                <option value="departamento">Departamento</option>
                <option value="area">Area</option>
                <option value="unidad">Unidad</option>
                <option value="cargo">Cargo</option>
                <option value="centro_costo">Centro de costo</option>
              </select>
              <input placeholder="Codigo" value={form.codigo} onChange={(event) => setForm((current) => ({ ...current, codigo: event.target.value }))} />
              <input placeholder="Nombre" value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} />
              <select value={form.parent_id} onChange={(event) => setForm((current) => ({ ...current, parent_id: event.target.value }))}>
                <option value="">Sin padre</option>
                {structureOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.tipo} - {item.nombre}
                  </option>
                ))}
              </select>
              <select
                value={form.responsable_empleado_id}
                onChange={(event) => setForm((current) => ({ ...current, responsable_empleado_id: event.target.value }))}
              >
                <option value="">Sin responsable</option>
                {catalogs.supervisores.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.codigo} - {item.nombres} {item.apellidos}
                  </option>
                ))}
              </select>
              <input
                placeholder="Descripcion"
                value={form.descripcion}
                onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))}
              />
            </div>
            <div className="form-actions">
              <button className="outline-button" type="button" onClick={resetForm}>
                Limpiar
              </button>
              <button className="primary-button" type="submit" disabled={saving}>
                <Save size={16} />
                {selectedId ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>

        <div className="panel">
          <PanelTitle title="Importacion Excel" subtitle="Sube un archivo con columnas como codigo, nombres, apellidos, sucursal_codigo, area_nombre y cargo_nombre." />
          <div className="stack-form">
            <input type="file" accept=".xlsx,.xls" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
            <div className="inline-hint">
              <span>Storage actual: {summary?.storage?.driver || 'database'}</span>
              <span>{selectedFile ? selectedFile.name : 'Sin archivo seleccionado'}</span>
            </div>
            <div className="form-actions">
              <button className="primary-button" type="button" onClick={handleImport} disabled={saving}>
                <Upload size={16} />
                Procesar archivo
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <PanelTitle title="Estructuras activas" subtitle="Listado operativo para reasignaciones, importaciones y futuras integraciones." />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Codigo</th>
                <th>Nombre</th>
                <th>Padre</th>
                <th>Responsable</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {structures.length ? structures.map((item) => (
                <tr key={item.id}>
                  <td><span className="status-pill muted">{item.tipo}</span></td>
                  <td>{item.codigo}</td>
                  <td>{item.nombre}</td>
                  <td>{item.parent_nombre || '-'}</td>
                  <td>{item.responsable_codigo ? `${item.responsable_codigo} - ${item.responsable_nombres}` : '-'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-button" type="button" onClick={() => startEdit(item)} aria-label="Editar">
                        <Plus size={16} />
                      </button>
                      <button className="icon-button danger" type="button" onClick={() => removeStructure(item.id)} aria-label="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="6">Sin estructuras registradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <PanelTitle title="Historial de importaciones" subtitle="Resumen de filas creadas, actualizadas y errores devueltos por el proceso." />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Estado</th>
                <th>Resumen</th>
                <th>Errores</th>
              </tr>
            </thead>
            <tbody>
              {imports.length ? imports.map((item) => (
                <tr key={item.id}>
                  <td>{item.nombre_archivo}</td>
                  <td><span className="status-pill">{item.estado}</span></td>
                  <td>
                    {item.filas_creadas} creadas / {item.filas_actualizadas} actualizadas
                  </td>
                  <td>{item.filas_con_error}</td>
                </tr>
              )) : (
                <tr><td colSpan="4">Sin importaciones registradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {imports[0]?.resumen ? (
          <pre className="json-block">{formatJson(imports[0].resumen)}</pre>
        ) : null}
      </div>
    </>
  );
}
