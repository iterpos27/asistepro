const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit',
});

function ecuadorDate(value = new Date()) {
  const parts = Object.fromEntries(formatter.formatToParts(value).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

module.exports = { ecuadorDate };
