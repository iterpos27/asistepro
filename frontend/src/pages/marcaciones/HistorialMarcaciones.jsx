import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import { useAuthContext } from '../../context/AuthContext';
import { ROLES } from '../../utils/roles';
import * as marcacionService from '../../services/marcacionService';

function statusClass(estado) {
  if (estado === 'aceptada') return 'status-pill';
  if (estado === 'aceptada_con_novedad') return 'status-pill warning';
  return 'status-pill muted';
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

export default function HistorialMarcaciones() {
  const { user } = useAuthContext();
  const canSeeGps = [ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPRESA, ROLES.RRHH].includes(user?.rol);
  const [marcaciones, setMarcaciones] = useState([]);
  const [total, setTotal] = useState(0);
  const [estado, setEstado] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadMarcaciones() {
    setLoading(true);
    setError('');

    try {
      const result = await marcacionService.listMarcaciones({
        estado,
        fechaDesde,
        fechaHasta,
        limit: 100,
      });
      setMarcaciones(result.items || []);
      setTotal(result.total || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudieron cargar las marcaciones');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMarcaciones();
  }, []);

  return (
    <>
      <PageHeader
        title="Historial de marcaciones"
        description="Registros QR + GPS con estado, distancia y novedades."
        actions={<span className="status-pill">{loading ? 'Cargando' : `${total} registros`}</span>}
      />

      <div className="panel">
        <PanelTitle title="Filtros" subtitle="Filtra por estado o rango de fechas" />
        <div className="toolbar-grid">
          <select value={estado} onChange={(event) => setEstado(event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="aceptada">Aceptada</option>
            <option value="aceptada_con_novedad">Con novedad</option>
            <option value="rechazada">Rechazada</option>
          </select>
          <input value={fechaDesde} onChange={(event) => setFechaDesde(event.target.value)} type="date" />
          <input value={fechaHasta} onChange={(event) => setFechaHasta(event.target.value)} type="date" />
          <button className="outline-button" type="button" onClick={loadMarcaciones}>
            <RotateCcw size={16} />
            Aplicar
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
                    <td>{marcacion.empleado_codigo || '-'}</td>
                    <td>{marcacion.sucursal_nombre || '-'}</td>
                    <td>{marcacion.tipo}</td>
                    <td>
                      <span className={statusClass(marcacion.estado)}>{marcacion.estado}</span>
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
                  <td colSpan={canSeeGps ? 8 : 7}>Sin marcaciones para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
