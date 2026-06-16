function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';

  const text = String(value);

  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function resolveColumnValue(row, column) {
  const value = row[column.key];
  return typeof column.format === 'function' ? column.format(value, row) : value;
}

function toCsv(rows, columns) {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(',');
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvValue(resolveColumnValue(row, column))).join(','),
  );

  return [header, ...body].join('\n');
}

module.exports = {
  toCsv,
};
