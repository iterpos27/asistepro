import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import PanelTitle from '../common/PanelTitle';
import PaginationBar from './PaginationBar';

function labelFor(column) {
  const labels = {
    empleado_codigo: 'Código',
    empleado_nombres: 'Empleado',
    sucursal_habitual_nombre: 'Sucursal habitual',
    sucursal_nombre: 'Sucursal',
    estado_asistencia: 'Asistencia',
    estado_jornada: 'Jornada',
    primera_entrada: 'Primera entrada',
    ultima_salida: 'Última salida',
    marcado_en: 'Fecha y hora',
    horas_trabajadas: 'Horas trabajadas',
    minutos_atraso: 'Min. atraso',
    tolerancia_minutos: 'Tolerancia',
    distancia_metros: 'Distancia',
    motivo_novedad: 'Motivo',
    detalle_novedad: 'Detalle',
    empleados_presentes: 'Presentes',
    total_marcaciones: 'Marcaciones',
  };
  return labels[column] || column.replace(/_/g, ' ');
}

export default function DataPanel({ title, rows, columns, pageSize = 10 }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => columns.some((column) => String(row[column] ?? '').toLowerCase().includes(term)));
  }, [columns, rows, search]);
  const visibleRows = filteredRows.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => {
    setPage(0);
  }, [rows, search]);

  return (
    <div className="panel data-panel">
      <PanelTitle title={title} subtitle={`${filteredRows.length} de ${rows.length} registros`} />
      <div className="table-toolbar compact-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Buscar en ${title.toLowerCase()}`}
            aria-label={`Buscar en ${title}`}
          />
        </label>
      </div>
      <div className="table-wrap table-compact">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{labelFor(column)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length ? (
              visibleRows.map((row, index) => (
                <tr key={row.id || index}>
                  {columns.map((column) => (
                    <td key={column}>{String(row[column] ?? '-')}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>Sin datos para mostrar.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {filteredRows.length > pageSize ? (
        <PaginationBar page={page} pageSize={pageSize} total={filteredRows.length} onPageChange={setPage} />
      ) : null}
    </div>
  );
}
