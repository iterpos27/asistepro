import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import { useAuthContext } from '../../context/AuthContext';
import { ROLES } from '../../utils/roles';
import * as marcacionService from '../../services/marcacionService';
import * as empleadoService from '../../services/empleadoService';
import * as sucursalService from '../../services/sucursalService';

function statusClass(estado) {
  if (estado === 'aceptada') return 'status-pill';
  if (estado === 'aceptada_con_novedad') return 'status-pill warning';
  return 'status-pill muted';
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

export default function HistorialGeneral() {
  const { user } = useAuthContext();
  const canSeeGps = [ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPRESA, ROLES.RRHH].includes(user?.rol);

  const [marcaciones, setMarcaciones] = useState([]);
  const [total, setTotal] = useState(0);
  
  // Lists for filters
  const [empleados, setEmpleados] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  
  // Filter States
  const [empleadoId, setEmpleadoId] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [estado, setEstado] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load initial options for filters (employees and sucursales)
  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [empRes, sucRes] = await Promise.all([
          empleadoService.listEmpleados({ limit: 200 }),
          sucursalService.listSucursales({ limit: 100 }),
        ]);
        setEmpleados(empRes.items || []);
        setSucursales(sucRes.items || []);
      } catch (err) {
        console.error('Error cargando opciones de filtros:', err);
      }
    }

    loadFilterOptions();
  }, []);

  async function loadMarcaciones(silent = false) {
    if (!silent) {
      setLoading(true);
      setError('');
    }

    try {
      const result = await marcacionService.listMarcaciones({
        empleadoId,
        sucursalId,
        estado,
        fechaDesde,
        fechaHasta,
        soloMios: false,
        limit: 100,
      });
      setMarcaciones(result.items || []);
      setTotal(result.total || 0);
    } catch (requestError) {
      if (!silent) {
        setError(requestError.response?.data?.message || 'No se pudieron cargar las marcaciones');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  // Reload data reactively when filters change and set up real-time silent polling
  useEffect(() => {
    loadMarcaciones();

    const interval = setInterval(() => {
      loadMarcaciones(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [empleadoId, sucursalId, estado, fechaDesde, fechaHasta]);

  const handleClearFilters = () => {
    setEmpleadoId('');
    setSucursalId('');
    setEstado('');
    setFechaDesde('');
    setFechaHasta('');
  };

  return (
    <>
      <PageHeader
        title="Historial general de marcaciones"
        description="Visualiza registros en tiempo real de todos los empleados con geocercas y novedades."
        actions={<span className="status-pill">{loading ? 'Cargando...' : `${total} registros`}</span>}
      />

      <div className="panel">
        <PanelTitle title="Filtros de Búsqueda" subtitle="Filtra por empleado, sucursal, estado o rango de fechas" />
        <div className="toolbar-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          
          <select value={empleadoId} onChange={(event) => setEmpleadoId(event.target.value)}>
            <option value="">Todos los empleados</option>
            {empleados.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.nombres} {emp.apellidos} ({emp.codigo})
              </option>
            ))}
          </select>

          <select value={sucursalId} onChange={(event) => setSucursalId(event.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((suc) => (
              <option key={suc.id} value={suc.id}>
                {suc.nombre}
              </option>
            ))}
          </select>

          <select value={estado} onChange={(event) => setEstado(event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="aceptada">Aceptada</option>
            <option value="aceptada_con_novedad">Con novedad</option>
            <option value="rechazada">Rechazada</option>
          </select>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Desde:</span>
            <input value={fechaDesde} onChange={(event) => setFechaDesde(event.target.value)} type="date" style={{ flex: 1 }} />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Hasta:</span>
            <input value={fechaHasta} onChange={(event) => setFechaHasta(event.target.value)} type="date" style={{ flex: 1 }} />
          </div>

          <button className="outline-button" type="button" onClick={handleClearFilters}>
            <RotateCcw size={16} />
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="panel">
        <PanelTitle title="Marcaciones registradas" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Sucursal</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Distancia</th>
                {canSeeGps ? <th>GPS</th> : null}
                <th>Novedad</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {marcaciones.length ? (
                marcaciones.map((marcacion) => (
                  <tr key={marcacion.id}>
                    <td>
                      <div style={{ fontWeight: '500' }}>
                        {marcacion.empleado_nombres ? `${marcacion.empleado_nombres} ${marcacion.empleado_apellidos || ''}` : '-'}
                      </div>
                      <small style={{ color: '#64748b' }}>Código: {marcacion.empleado_codigo || '-'}</small>
                    </td>
                    <td>{marcacion.sucursal_nombre || '-'}</td>
                    <td>{marcacion.tipo === 'entrada' ? 'Entrada' : 'Salida'}</td>
                    <td>
                      <span className={statusClass(marcacion.estado)}>{marcacion.estado.replace(/_/g, ' ')}</span>
                    </td>
                    <td>{marcacion.distancia_metros ? `${Number(marcacion.distancia_metros).toFixed(2)} m` : '-'}</td>
                    {canSeeGps ? (
                      <td>
                        {marcacion.latitud && marcacion.longitud
                          ? `${Number(marcacion.latitud).toFixed(7)}, ${Number(marcacion.longitud).toFixed(7)}`
                          : '-'}
                      </td>
                    ) : null}
                    <td>{marcacion.motivo_novedad || '-'}</td>
                    <td>{formatDateTime(marcacion.marcado_en)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canSeeGps ? 8 : 7} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                    Sin marcaciones para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
