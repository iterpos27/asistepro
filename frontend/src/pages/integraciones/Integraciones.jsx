import { useEffect, useState } from 'react';
import { Download, Play, PlugZap, Save, Trash2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import { toast } from '../../services/toastService';
import * as integracionService from '../../services/integracionService';
import * as sucursalService from '../../services/sucursalService';
import UsuariosBiometrico from './UsuariosBiometrico';

const initialForm = {
  nombre: '',
  tipo: 'nomina',
  proveedor: '',
  estado: 'activa',
  api_key: '',
  configuracion: '{\n  "sucursal_id": ""\n}',
};

const biometricConfig = {
  modo_conexion: 'directo',
  ip: '192.168.1.201',
  puerto: 4370,
  timeout_ms: 10000,
  puerto_udp_local: 4000,
  sucursal_id: '',
  intervalo_segundos: 60,
  dias_importar: 30,
  zona_horaria_offset: '-05:00',
  usuarios_mapeo: {},
};

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

export default function Integraciones() {
  const [data, setData] = useState({ items: [], ejecuciones: [], storage: null });
  const [form, setForm] = useState(initialForm);
  const [selectedId, setSelectedId] = useState('');
  const [runPayload, setRunPayload] = useState('{\n  "mes": "2026-06",\n  "plantilla": "detalle_diario",\n  "tipo_archivo": "csv"\n}');
  const [saving, setSaving] = useState(false);
  const [sucursales, setSucursales] = useState([]);
  const [biometricId, setBiometricId] = useState('');

  async function loadData() {
    const result = await integracionService.listIntegraciones();
    setData(result);
  }

  useEffect(() => {
    loadData();
    sucursalService.listSucursales({ estado: 'activa', limit: 100 })
      .then((result) => setSucursales(result.items || []))
      .catch(() => setSucursales([]));
  }, []);

  function resetForm() {
    setSelectedId('');
    setForm(initialForm);
  }

  function changeType(tipo) {
    setForm((current) => ({
      ...current,
      tipo,
      proveedor: tipo === 'biometrico' && !current.proveedor ? 'ZKTeco MB10-VL' : current.proveedor,
      configuracion: tipo === 'biometrico'
        ? JSON.stringify(biometricConfig, null, 2)
        : current.configuracion,
    }));
  }

  function updateBiometricConfig(key, value) {
    const configuration = parseJson(form.configuracion);
    setForm((current) => ({
      ...current,
      configuracion: JSON.stringify({ ...configuration, [key]: value }, null, 2),
    }));
  }

  function editItem(item) {
    setSelectedId(item.id);
    setForm({
      nombre: item.nombre,
      tipo: item.tipo,
      proveedor: item.proveedor,
      estado: item.estado,
      api_key: '',
      configuracion: JSON.stringify(item.configuracion || {}, null, 2),
    });
  }

  async function saveIntegration(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, configuracion: parseJson(form.configuracion) };
      if (selectedId) {
        await integracionService.updateIntegracion(selectedId, payload);
        toast.success('Integracion actualizada');
      } else {
        await integracionService.createIntegracion(payload);
        toast.success('Integracion creada');
      }
      resetForm();
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function removeIntegration(id) {
    await integracionService.deleteIntegracion(id);
    toast.success('Integracion desactivada');
    await loadData();
  }

  async function runIntegration(id) {
    const result = await integracionService.runIntegracion(id, parseJson(runPayload));
    toast.success('Integracion ejecutada');
    setRunPayload(JSON.stringify(result, null, 2));
    await loadData();
  }

  async function downloadIntegration(id) {
    const { blob, fileName } = await integracionService.downloadIntegracion(id, parseJson(runPayload));
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success('Archivo descargado');
  }

  const biometric = data.items.find(item => item.id === biometricId);
  if (biometric) return <UsuariosBiometrico key={biometric.id} integration={biometric}
    onChanged={loadData} onBack={() => { setBiometricId(''); resetForm(); }} />;

  return (
    <>
      <PageHeader
        title="Integraciones"
        description="Conecta exportes laborales, biometria y storage externo sin meter logica sensible dentro del core de asistencia."
        actions={<span className="status-pill">{data.storage?.driver || 'database'}</span>}
      />

      <div className="dashboard-split">
        <div className="panel">
          <PanelTitle title={selectedId ? 'Editar integracion' : 'Nueva integracion'} subtitle="La configuracion JSON queda versionada y lista para pruebas manuales." />
          <form className="stack-form" onSubmit={saveIntegration}>
            <div className="toolbar-grid">
              <input placeholder="Nombre" value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} />
              <select value={form.tipo} onChange={(event) => changeType(event.target.value)}>
                <option value="nomina">Exportacion laboral</option>
                <option value="biometrico">Biometrico</option>
                <option value="storage">Storage</option>
              </select>
              <input placeholder="Proveedor" value={form.proveedor} onChange={(event) => setForm((current) => ({ ...current, proveedor: event.target.value }))} />
              <select value={form.estado} onChange={(event) => setForm((current) => ({ ...current, estado: event.target.value }))}>
                <option value="activa">Activa</option>
                <option value="inactiva">Inactiva</option>
                <option value="error">Error</option>
              </select>
              <input placeholder="API key opcional" value={form.api_key} onChange={(event) => setForm((current) => ({ ...current, api_key: event.target.value }))} />
            </div>
            <textarea rows="10" value={form.configuracion} onChange={(event) => setForm((current) => ({ ...current, configuracion: event.target.value }))} />
            {form.tipo === 'biometrico' ? (
              <>
                <div className="toolbar-grid">
                  <input
                    aria-label="IP del biometrico"
                    placeholder="IP del biometrico"
                    value={parseJson(form.configuracion).ip || ''}
                    onChange={(event) => updateBiometricConfig('ip', event.target.value)}
                  />
                  <select
                    aria-label="Sucursal del biometrico"
                    value={parseJson(form.configuracion).sucursal_id || ''}
                    onChange={(event) => updateBiometricConfig('sucursal_id', event.target.value)}
                  >
                    <option value="">Selecciona la sucursal</option>
                    {sucursales.map((sucursal) => (
                      <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="inline-hint">
                  <span>Vincula los IDs del equipo desde Usuarios del biométrico después de guardar.</span>
                  <span>Usa una IP fija local para el equipo.</span>
                </div>
              </>
            ) : null}
            <div className="form-actions">
              <button className="outline-button" type="button" onClick={resetForm}>Limpiar</button>
              <button className="primary-button" type="submit" disabled={saving}>
                <Save size={16} />
                Guardar integracion
              </button>
            </div>
          </form>
        </div>

        <div className="panel">
          <PanelTitle title="Ejecucion manual" subtitle="En biometricos con conexion directa no necesitas modificar este contenido: pulsa Ejecutar." />
          <textarea rows="14" value={runPayload} onChange={(event) => setRunPayload(event.target.value)} />
          <div className="inline-hint">
            <span>Laboral: usa `plantilla` = `detalle_diario`, `resumen_mensual` o `cliente`.</span>
            <span>Archivo: `tipo_archivo` = `csv` o `xlsx`.</span>
          </div>
        </div>
      </div>

      <div className="panel">
        <PanelTitle title="Integraciones activas" subtitle="Estado operativo y accesos directos para ejecucion." />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Proveedor</th>
                <th>Estado</th>
                <th>Ultima ejecucion</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length ? data.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.nombre}</td>
                  <td><span className="status-pill muted">{item.tipo}</span></td>
                  <td>{item.proveedor}</td>
                  <td><span className="status-pill">{item.estado}</span></td>
                  <td>{item.ultima_ejecucion_estado || '-'}</td>
                  <td>
                    <div className="row-actions">
                      {item.tipo === 'biometrico' && item.configuracion?.ip && <button className="outline-button" type="button" onClick={() => setBiometricId(item.id)}>Usuarios del biométrico</button>}
                      <button className="icon-button" type="button" onClick={() => editItem(item)} title="Editar" aria-label="Editar">
                        <PlugZap size={16} />
                      </button>
                      <button className="icon-button" type="button" onClick={() => runIntegration(item.id)} title="Ejecutar" aria-label="Ejecutar">
                        <Play size={16} />
                      </button>
                      {item.tipo === 'nomina' ? (
                        <button className="icon-button" type="button" onClick={() => downloadIntegration(item.id)} title="Descargar" aria-label="Descargar">
                          <Download size={16} />
                        </button>
                      ) : null}
                      <button className="icon-button danger" type="button" onClick={() => removeIntegration(item.id)} title="Desactivar" aria-label="Desactivar">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="6">Sin integraciones registradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <PanelTitle title="Bitacora reciente" subtitle="Ultimas ejecuciones laborales, biometria y almacenamiento." />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Accion</th>
                <th>Estado</th>
                <th>Resumen</th>
              </tr>
            </thead>
            <tbody>
              {data.ejecuciones.length ? data.ejecuciones.map((item) => (
                <tr key={item.id}>
                  <td>{item.accion}</td>
                  <td><span className="status-pill">{item.estado}</span></td>
                  <td>{JSON.stringify(item.resumen || {})}</td>
                </tr>
              )) : (
                <tr><td colSpan="3">Sin ejecuciones registradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
