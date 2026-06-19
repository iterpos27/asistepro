import PanelTitle from '../common/PanelTitle';

export default function DataPanel({ title, rows, columns }) {
  return (
    <div className="panel">
      <PanelTitle title={title} />
      <div className="table-wrap table-compact">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column.replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.slice(0, 8).map((row, index) => (
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
    </div>
  );
}
