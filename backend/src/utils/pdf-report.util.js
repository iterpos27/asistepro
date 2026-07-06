const PDFDocument = require('pdfkit');

function collectPdfBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function formatDate(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-EC', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Guayaquil',
  });
}

function formatHours(value) {
  if (value === null || value === undefined || value === '') return '-';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '-';
  return `${numeric.toFixed(2)}h`;
}

function drawHeader(doc, empresa, logoBuffer, filters) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startX = doc.page.margins.left;
  let cursorY = doc.page.margins.top;

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, startX, cursorY, { fit: [70, 70], align: 'left', valign: 'center' });
    } catch {
      // Si el archivo no es compatible, continuamos sin romper el PDF.
    }
  }

  const textX = logoBuffer ? startX + 88 : startX;
  doc.fontSize(18).fillColor('#0f172a').text(empresa?.nombre || 'Empresa', textX, cursorY, {
    width: pageWidth - (textX - startX),
  });
  cursorY += 24;

  doc.fontSize(10).fillColor('#475569');
  doc.text(`Identificacion: ${empresa?.identificacion_fiscal || '-'}`, textX, cursorY);
  cursorY += 14;
  doc.text(`Correo: ${empresa?.email || '-'}   Telefono: ${empresa?.telefono || '-'}`, textX, cursorY);
  cursorY += 14;
  doc.text(`Direccion: ${empresa?.direccion || '-'}`, textX, cursorY, { width: pageWidth - (textX - startX) });

  const headerBottom = Math.max(cursorY + 22, doc.page.margins.top + 78);
  doc.moveTo(startX, headerBottom).lineTo(startX + pageWidth, headerBottom).strokeColor('#cbd5e1').stroke();

  const titleY = headerBottom + 14;
  doc.fontSize(15).fillColor('#0f172a').text('Reporte de asistencia por rango', startX, titleY);
  doc.fontSize(10).fillColor('#475569');
  doc.text(`Periodo: ${formatDate(filters.fechaDesde)} al ${formatDate(filters.fechaHasta)}`, startX, titleY + 20);
  doc.text(`Generado: ${formatDateTime(new Date().toISOString())}`, startX, titleY + 34);
  return titleY + 56;
}

function drawSummary(doc, summary, startY) {
  const cards = [
    { label: 'Registros', value: String(summary.total || 0) },
    { label: 'Presentes', value: String(summary.presentes || 0) },
    { label: 'Ausentes', value: String(summary.ausentes || 0) },
    { label: 'Horas', value: formatHours(summary.horas || 0) },
  ];

  const startX = doc.page.margins.left;
  const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 10;
  const cardWidth = (availableWidth - gap * (cards.length - 1)) / cards.length;
  const cardHeight = 52;

  cards.forEach((card, index) => {
    const x = startX + index * (cardWidth + gap);
    doc.roundedRect(x, startY, cardWidth, cardHeight, 8).fillAndStroke('#f8fafc', '#dbe4f0');
    doc.fillColor('#64748b').fontSize(9).text(card.label, x + 12, startY + 10, { width: cardWidth - 24 });
    doc.fillColor('#0f172a').fontSize(14).text(card.value, x + 12, startY + 25, { width: cardWidth - 24 });
  });

  return startY + cardHeight + 18;
}

function drawTable(doc, rows, startY) {
  const startX = doc.page.margins.left;
  const columns = [
    { key: 'fecha', label: 'Fecha', width: 60 },
    { key: 'empleado_codigo', label: 'Codigo', width: 58 },
    { key: 'empleado_nombres', label: 'Nombres', width: 92 },
    { key: 'empleado_apellidos', label: 'Apellidos', width: 92 },
    { key: 'sucursal_habitual_nombre', label: 'Sucursal', width: 92 },
    { key: 'estado_asistencia', label: 'Estado', width: 54 },
    { key: 'primera_entrada', label: 'Entrada', width: 82 },
    { key: 'ultima_salida', label: 'Salida', width: 82 },
    { key: 'horas_trabajadas', label: 'Horas', width: 48 },
  ];

  const rowHeight = 22;
  let y = startY;

  function ensureSpace(nextHeight) {
    if (y + nextHeight <= doc.page.height - doc.page.margins.bottom) return;
    doc.addPage();
    y = doc.page.margins.top;
    drawHeaderRow();
  }

  function drawHeaderRow() {
    let x = startX;
    doc.rect(startX, y, columns.reduce((sum, column) => sum + column.width, 0), rowHeight).fill('#e2e8f0');
    columns.forEach((column) => {
      doc.fillColor('#0f172a').fontSize(8).text(column.label, x + 4, y + 7, {
        width: column.width - 8,
        align: 'left',
      });
      x += column.width;
    });
    y += rowHeight;
  }

  drawHeaderRow();

  rows.forEach((row, index) => {
    ensureSpace(rowHeight);
    let x = startX;
    if (index % 2 === 0) {
      doc.rect(startX, y, columns.reduce((sum, column) => sum + column.width, 0), rowHeight).fill('#f8fafc');
    }
    columns.forEach((column) => {
      let value = row[column.key];
      if (column.key === 'fecha') value = formatDate(value);
      if (column.key === 'primera_entrada' || column.key === 'ultima_salida') value = formatDateTime(value);
      if (column.key === 'horas_trabajadas') value = formatHours(value);
      doc.fillColor('#334155').fontSize(7.5).text(String(value || '-'), x + 4, y + 7, {
        width: column.width - 8,
        ellipsis: true,
      });
      x += column.width;
    });
    y += rowHeight;
  });

  return y;
}

async function buildAsistenciaRangoPdf({ empresa, logoBuffer, filters, rows, summary }) {
  const doc = new PDFDocument({
    margin: 34,
    size: 'A4',
    layout: 'landscape',
    info: {
      Title: `Reporte asistencia ${empresa?.nombre || ''}`.trim(),
      Author: 'AsistePro',
    },
  });
  const bufferPromise = collectPdfBuffer(doc);

  let y = drawHeader(doc, empresa, logoBuffer, filters);
  y = drawSummary(doc, summary, y);
  drawTable(doc, rows, y);

  doc.end();
  return bufferPromise;
}

module.exports = {
  buildAsistenciaRangoPdf,
};
