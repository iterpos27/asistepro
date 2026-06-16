function escapeHtml(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveColumnValue(row, column) {
  const value = row[column.key];
  return typeof column.format === 'function' ? column.format(value, row) : value;
}

function toExcelHtml(rows, columns, title = 'Reporte') {
  const header = columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(resolveColumnValue(row, column))}</td>`).join('')}</tr>`)
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
    th { background: #1f7a4f; color: #ffffff; font-weight: 700; }
    th, td { border: 1px solid #d9e2ef; padding: 6px 8px; }
  </style>
</head>
<body>
  <h3>${escapeHtml(title)}</h3>
  <table>
    <thead><tr>${header}</tr></thead>
    <tbody>${body}</tbody>
  </table>
</body>
</html>`;
}

module.exports = {
  toExcelHtml,
};
