import { useEffect, useMemo, useState } from 'react';
import { Activity, Download, FileBarChart, RotateCcw, UserCheck, Users } from 'lucide-react';
import MetricCard from '../../components/cards/MetricCard';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import DataPanel from '../../components/tables/DataPanel';
import * as empleadoService from '../../services/empleadoService';
import * as reporteService from '../../services/reporteService';
import * as sucursalService from '../../services/sucursalService';

const emptyReport = { resumen: {}, items: [], total: 0 };
const attendanceStates = ['presente', 'ausente'];
const markStates = ['aceptada', 'aceptada_con_novedad', 'rechazada'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth(value) {
  return (value || today()).slice(0, 7);
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function normalizeDailyRows(rows) {
  return rows.map((row) => ({
    ...row,
    primera_entrada: formatDateTime(row.primera_entrada),
    ultima_salida: formatDateTime(row.ultima_salida),
  }));
}

function normalizeEventRows(rows) {
  return rows.map((row) => ({
    ...row,
    marcado_en: formatDateTime(row.marcado_en),
    distancia_metros: row.distancia_metros ? `${Number(row.distancia_metros).toFixed(2)} m` : '-',
  }));
}

export default function Reportes() {
  const [filters, setFilters] = useState({
    fechaDesde: today(),
    fechaHasta: today(),
    sucursalId: '',
    empleadoId: '',
    estado: '',
  });
  const [sucursales, setSucursales] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [diaria, setDiaria] = useState(emptyReport);
  const [mensual, setMensual] = useState(emptyReport);
  const [novedades, setNovedades] = useState(emptyReport);
  const [atrasos, setAtrasos] = useState(emptyReport);
  const [loading, setLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [error, setError] = useState('');

  const reportParams = useMemo(
    () => ({
      fecha: filters.fechaHasta || filters.fechaDesde || today(),
      mes: currentMonth(filters.fechaDesde),
      fechaDesde: filters.fechaDesde,
      fechaHasta: filters.fechaHasta,
      sucursalId: filters.sucursalId,
      empleadoId: filters.empleadoId,
      dailyStatus: attendanceStates.includes(filters.estado) ? filters.estado : '',
      markStatus: markStates.includes(filters.estado) ? filters.estado : '',
    }),
    [filters],
  );

  async function loadCatalogs() {
    try {
      const [sucursalesResult, empleadosResult] = await Promise.all([
        sucursalService.listSucursales({ estado: 'activa', limit: 200 }),
        empleadoService.listEmpleados({ estado: 'activo', limit: 300 }),
      ]);
      setSucursales(sucursalesResult.items || []);
      setEmpleados(empleadosResult.items || []);
    } catch {
      setSucursales([]);
      setEmpleados([]);
    }
  }

  async function loadReports() {
    setLoading(true);
    setError('');

    try {
      const [dailyResult, monthlyResult, novedadesResult, atrasosResult] = await Promise.all([
        reporteService.getAsistenciaDiaria({
          fecha: reportParams.fecha,
          sucursalId: reportParams.sucursalId,
          empleadoId: reportParams.empleadoId,
          estado: reportParams.dailyStatus,
        }),
        reporteService.getAsistenciaMensual({
          mes: reportParams.mes,
          sucursalId: reportParams.sucursalId,
          empleadoId: reportParams.empleadoId,
          estado: reportParams.markStatus,
        }),
        reporteService.getNovedades({
          fechaDesde: reportParams.fechaDesde,
          fechaHasta: reportParams.fechaHasta,
          sucursalId: reportParams.sucursalId,
          empleadoId: reportParams.empleadoId,
        }),
        reporteService.getAtrasos({
          fechaDesde: reportParams.fechaDesde,
          fechaHasta: reportParams.fechaHasta,
          sucursalId: reportParams.sucursalId,
          empleadoId: reportParams.empleadoId,
        }),
      ]);

      setDiaria(dailyResult || emptyReport);
      setMensual(monthlyResult || emptyReport);
      setNovedades(novedadesResult || emptyReport);
      setAtrasos(atrasosResult || emptyReport);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudieron cargar los reportes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalogs();
    loadReports();
  }, []);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function exportCsv(type) {
    setExportStatus('Preparando archivo');

    try {
      if (type === 'diaria') {
        await reporteService.downloadCsv(
          '/reportes/export/asistencia-diaria.csv',
          {
            fecha: reportParams.fecha,
            sucursal_id: reportParams.sucursalId,
            empleado_id: reportParams.empleadoId,
            estado: reportParams.dailyStatus,
          },
          `asistencia-diaria-${reportParams.fecha}.csv`,
        );
      }

      if (type === 'novedades') {
        await reporteService.downloadCsv(
          '/reportes/export/novedades.csv',
          {
            fecha_desde: reportParams.fechaDesde,
            fecha_hasta: reportParams.fechaHasta,
            sucursal_id: reportParams.sucursalId,
            empleado_id: reportParams.empleadoId,
          },
          'novedades.csv',
        );
      }

      if (type === 'atrasos') {
        await reporteService.downloadCsv(
          '/reportes/export/atrasos.csv',
          {
            fecha_desde: reportParams.fechaDesde,
            fecha_hasta: reportParams.fechaHasta,
            sucursal_id: reportParams.sucursalId,
            empleado_id: reportParams.empleadoId,
          },
          'atrasos.csv',
        );
      }

      setExportStatus('Archivo descargado');
    } catch {
      setExportStatus('No se pudo descargar');
    }
  }

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Asistencia diaria, mensual, novedades, atrasos y exportaciones."
        actions={<span className="status-pill">{loading ? 'Cargando' : 'Reportes listos'}</span>}
      />

      <div className="panel">
        <PanelTitle title="Filtros" subtitle="Rango, sucursal, empleado y estado" />
        <div className="toolbar-grid">
          <input value={filters.fechaDesde} onChange={(event) => updateFilter('fechaDesde', event.target.value)} type="date" />
          <input value={filters.fechaHasta} onChange={(event) => updateFilter('fechaHasta', event.target.value)} type="date" />
          <select value={filters.sucursalId} onChange={(event) => updateFilter('sucursalId', event.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>
                {sucursal.nombre}
              </option>
            ))}
          </select>
          <select value={filters.empleadoId} onChange={(event) => updateFilter('empleadoId', event.target.value)}>
            <option value="">Todos los empleados</option>
            {empleados.map((empleado) => (
              <option key={empleado.id} value={empleado.id}>
                {empleado.codigo} - {empleado.nombres} {empleado.apellidos}
              </option>
            ))}
          </select>
          <select value={filters.estado} onChange={(event) => updateFilter('estado', event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="presente">Presente</option>
            <option value="ausente">Ausente</option>
            <option value="aceptada">Aceptada</option>
            <option value="aceptada_con_novedad">Con novedad</option>
            <option value="rechazada">Rechazada</option>
          </select>
          <button className="outline-button" type="button" onClick={loadReports} disabled={loading}>
            <RotateCcw size={16} />
            Aplicar
          </button>
        </div>
      </div>

      {error ? <div className="alert-error">{error}</div> : null}

      <section className="metrics-grid">
        <MetricCard label="Presentes" value={diaria.resumen?.presentes || 0} icon={UserCheck} tone="success" />
        <MetricCard label="Ausentes" value={diaria.resumen?.ausentes || 0} icon={Users} tone="warning" />
        <MetricCard label="Marcaciones mes" value={mensual.resumen?.total_marcaciones || 0} icon={Activity} />
        <MetricCard label="Atrasos" value={atrasos.total || 0} icon={FileBarChart} tone="accent" />
      </section>

      <div className="panel">
        <PanelTitle title="Exportacion" subtitle="Archivos CSV generados por el backend y compatibles con Excel" />
        <div className="form-actions">
          <button className="outline-button" type="button" onClick={() => exportCsv('diaria')}>
            <Download size={16} />
            Asistencia diaria
          </button>
          <button className="outline-button" type="button" onClick={() => exportCsv('novedades')}>
            <Download size={16} />
            Novedades
          </button>
          <button className="outline-button" type="button" onClick={() => exportCsv('atrasos')}>
            <Download size={16} />
            Atrasos
          </button>
          {exportStatus ? <span className="status-pill muted">{exportStatus}</span> : null}
        </div>
      </div>

      <DataPanel
        title="Asistencia diaria"
        rows={normalizeDailyRows(diaria.items || [])}
        columns={['empleado_codigo', 'empleado_nombres', 'sucursal_habitual_nombre', 'estado_asistencia', 'primera_entrada', 'ultima_salida', 'novedades']}
      />
      <DataPanel
        title="Asistencia mensual"
        rows={mensual.items || []}
        columns={['fecha', 'empleados_presentes', 'aceptadas', 'novedades', 'rechazadas', 'total_marcaciones']}
      />
      <DataPanel
        title="Novedades"
        rows={normalizeEventRows(novedades.items || [])}
        columns={['marcado_en', 'empleado_codigo', 'sucursal_nombre', 'tipo', 'motivo_novedad', 'detalle_novedad', 'distancia_metros']}
      />
      <DataPanel
        title="Atrasos"
        rows={normalizeEventRows(atrasos.items || [])}
        columns={['marcado_en', 'empleado_codigo', 'sucursal_nombre', 'horario_nombre', 'hora_inicio', 'tolerancia_minutos', 'minutos_atraso']}
      />
    </>
  );
}
