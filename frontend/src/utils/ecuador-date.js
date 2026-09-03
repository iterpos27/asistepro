const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function ecuadorDate(value = new Date()) {
  const parts = Object.fromEntries(formatter.formatToParts(value).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function ecuadorDateTime(value) {
  return value ? new Date(value).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }) : '-';
}
