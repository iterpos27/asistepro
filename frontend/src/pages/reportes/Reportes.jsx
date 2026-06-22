import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Download, FileBarChart, Receipt, RotateCcw, UserCheck, Users } from 'lucide-react';
import MetricCard from '../../components/cards/MetricCard';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import DataPanel from '../../components/tables/DataPanel';
import { useAuthContext } from '../../context/AuthContext';
import * as empleadoService from '../../services/empleadoService';
import * as reporteService from '../../services/reporteService';
import * as sucursalService from '../../services/sucursalService';
import { toast } from '../../services/toastService';
import { ROLES } from '../../utils/roles';

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

function formatDecimalHours(value) {
  if (value === null || value === undefined || value === '-' || value === '' || isNaN(Number(value))) return '-';
  const hours = Number(value);
  if (hours === 0) return '0h';
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (wholeHours === 0) return `${minutes}m`;
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}

function normalizeDailyRows(rows) {
  return rows.map((row) => ({
    ...row,
    primera_entrada: formatDateTime(row.primera_entrada),
    ultima_salida: formatDateTime(row.ultima_salida),
    horas_trabajadas: formatDecimalHours(row.horas_trabajadas),
  }));
}

function normalizeEventRows(rows) {
  return rows.map((row) => ({
    ...row,
    marcado_en: formatDateTime(row.marcado_en),
    distancia_metros: row.distancia_metros ? `${Number(row.distancia_metros).toFixed(2)} m` : '-',
  }));
}

function normalizeEntradaSalidaRows(rows) {
  return rows.map((row) => ({
    ...row,
    entrada: formatDateTime(row.entrada),
    salida: formatDateTime(row.salida),
    horas_trabajadas: formatDecimalHours(row.horas_trabajadas),
    minutos_trabajados: row.minutos_trabajados ?? '-',
  }));
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function Reportes() {
  const { user } = useAuthContext();
  const canSeeFinancial = user?.rol === ROLES.ADMIN_EMPRESA || user?.rol === ROLES.SUPER_ADMIN;
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
  const [entradasSalidas, setEntradasSalidas] = useState(emptyReport);
  const [novedades, setNovedades] = useState(emptyReport);
  const [atrasos, setAtrasos] = useState(emptyReport);
  const [resumenEjecutivo, setResumenEjecutivo] = useState({ resumen: {} });
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
        sucursalService.listSucursales({ estado: 'activa', limit: 100 }),
        empleadoService.listEmpleados({ estado: 'activo', limit: 100 }),
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
      const [dailyResult, monthlyResult, entradasSalidasResult, novedadesResult, atrasosResult, resumenResult] = await Promise.all([
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
        reporteService.getEntradasSalidas({
          fechaDesde: reportParams.fechaDesde,
          fechaHasta: reportParams.fechaHasta,
          sucursalId: reportParams.sucursalId,
          empleadoId: reportParams.empleadoId,
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
        reporteService.getResumenEjecutivo({
          fechaDesde: reportParams.fechaDesde,
          fechaHasta: reportParams.fechaHasta,
          sucursalId: reportParams.sucursalId,
          empleadoId: reportParams.empleadoId,
        }),
      ]);

      setDiaria(dailyResult || emptyReport);
      setMensual(monthlyResult || emptyReport);
      setEntradasSalidas(entradasSalidasResult || emptyReport);
      setNovedades(novedadesResult || emptyReport);
      setAtrasos(atrasosResult || emptyReport);
      setResumenEjecutivo(resumenResult || { resumen: {} });
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

      if (type === 'entradas-salidas') {
        await reporteService.downloadFile(
          '/reportes/export/entradas-salidas.xls',
          {
            fecha_desde: reportParams.fechaDesde,
            fecha_hasta: reportParams.fechaHasta,
            sucursal_id: reportParams.sucursalId,
            empleado_id: reportParams.empleadoId,
          },
          'entradas-salidas.xls',
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
      toast.success('Archivo descargado');
    } catch {
      setExportStatus('No se pudo descargar');
      toast.error('No se pudo descargar el archivo');
    }
  }

  const resumen = resumenEjecutivo.resumen || {};
  const managerialAlerts = [
    {
      title: 'Jornadas incompletas',
      value: resumen.jornadas_incompletas || 0,
      description: 'Entradas sin salida o registros inconsistentes.',
    },
    {
      title: 'Solicitudes pendientes',
      value: resumen.solicitudes_pendientes || 0,
      description: 'Permisos o correcciones que esperan revision.',
    },
    {
      title: 'Atrasos del periodo',
      value: resumen.atrasos || 0,
      description: 'Entradas fuera de tolerancia configurada.',
    },
    canSeeFinancial
      ? {
          title: 'Facturas vencidas',
          value: resumen.facturas_vencidas || 0,
          description: `Saldo pendiente ${money(resumen.saldo_pendiente || 0)}.`,
        }
      : null,
  ].filter((item) => item && Number(item.value || 0) > 0);

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Vista gerencial y operativa de asistencia, horas, novedades, atrasos y cobranza."
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

      <section className="metrics-grid">
        <MetricCard label="Presentes" value={diaria.resumen?.presentes || 0} icon={UserCheck} tone="success" />
        <MetricCard label="Ausentes" value={resumen.ausentes_estimados ?? diaria.resumen?.ausentes ?? 0} icon={Users} tone="warning" />
        <MetricCard label="Puntualidad" value={`${Number(resumen.puntualidad_porcentaje || 0).toFixed(0)}%`} icon={Activity} />
        <MetricCard label="Horas trabajadas" value={formatDecimalHours(entradasSalidas.resumen?.horas_trabajadas)} icon={FileBarChart} tone="accent" />
      </section>

      <section className="metrics-grid">
        <MetricCard label="Jornadas completas" value={resumen.jornadas_completas || entradasSalidas.resumen?.completas || 0} icon={UserCheck} tone="success" />
        <MetricCard label="Jornadas incompletas" value={resumen.jornadas_incompletas || entradasSalidas.resumen?.sin_salida || 0} icon={AlertTriangle} tone="warning" />
        <MetricCard label="Novedades" value={resumen.novedades || novedades.total || 0} icon={Activity} tone="accent" />
        {canSeeFinancial ? <MetricCard label="Saldo pendiente" value={money(resumen.saldo_pendiente || 0)} icon={Receipt} tone="warning" /> : null}
      </section>

      <div className="dashboard-split">
        <div className="panel">
          <PanelTitle title="Resumen gerencial" subtitle="Lectura ejecutiva del periodo seleccionado" />
          <div className="stack-list">
            <div className="list-row"><strong>Empleados activos</strong><span>{resumen.total_empleados || 0}</span></div>
            <div className="list-row"><strong>Con marcacion</strong><span>{resumen.empleados_con_marcacion || 0}</span></div>
            <div className="list-row"><strong>Cumplimiento jornada</strong><span>{Number(resumen.cumplimiento_jornada_porcentaje || 0).toFixed(0)}%</span></div>
            <div className="list-row"><strong>Promedio horas / jornada</strong><span>{formatDecimalHours(resumen.promedio_horas_jornada)}</span></div>
          </div>
        </div>

        <div className="panel">
          <PanelTitle title="Alertas del periodo" subtitle="Hallazgos para supervision y cobranza" />
          <div className="stack-list">
            {managerialAlerts.length ? (
              managerialAlerts.map((item) => (
                <div className="list-row" key={item.title}>
                  <div>
                    <strong>{item.title}</strong>
                    <span className="table-subtext">{item.description}</span>
                  </div>
                  <span className="status-pill warning">{item.value}</span>
                </div>
              ))
            ) : (
              <div className="list-row">
                <div>
                  <strong>Sin alertas relevantes</strong>
                  <span className="table-subtext">El periodo seleccionado no muestra pendientes operativos o financieros graves.</span>
                </div>
                <span className="status-pill">OK</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <PanelTitle title="Exportacion" subtitle="Archivos de asistencia, novedades, atrasos y entradas/salidas" />
        <div className="form-actions">
          <button className="outline-button" type="button" onClick={() => exportCsv('diaria')}>
            <Download size={16} />
            Asistencia diaria
          </button>
          <button className="outline-button" type="button" onClick={() => exportCsv('entradas-salidas')}>
            <Download size={16} />
            Entradas y salidas Excel
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
        columns={['empleado_codigo', 'empleado_nombres', 'sucursal_habitual_nombre', 'estado_asistencia', 'primera_entrada', 'ultima_salida', 'horas_trabajadas', 'novedades']}
      />
      <DataPanel
        title="Entradas y salidas"
        rows={normalizeEntradaSalidaRows(entradasSalidas.items || [])}
        columns={['fecha', 'empleado_codigo', 'empleado_nombres', 'sucursal_habitual_nombre', 'entrada', 'salida', 'horas_trabajadas', 'estado_jornada']}
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
