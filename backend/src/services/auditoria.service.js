const { pool } = require('../config/database');
const { getFriendlyRouteAndAction, sanitizeValue } = require('../middlewares/audit.middleware');

async function list({ empresaId, usuarioId, entidad, metodo, fechaDesde, fechaHasta, search, limit, offset }) {
  const filters = ['l.empresa_id = $1']; const values = [empresaId];
  if (usuarioId) { values.push(usuarioId); filters.push(`l.usuario_id=$${values.length}`); }
  if (entidad) { values.push(entidad); filters.push(`l.entidad=$${values.length}`); }
  if (metodo) { values.push(metodo); filters.push(`l.metodo=$${values.length}`); }
  if (fechaDesde) { values.push(fechaDesde); filters.push(`l.creado_en >= $${values.length}::date`); }
  if (fechaHasta) { values.push(fechaHasta); filters.push(`l.creado_en < ($${values.length}::date + INTERVAL '1 day')`); }
  if (search) { values.push(`%${search}%`); filters.push(`(u.email ILIKE $${values.length} OR l.accion ILIKE $${values.length} OR l.ruta ILIKE $${values.length})`); }
  values.push(limit); const limitIndex = values.length; values.push(offset); const offsetIndex = values.length;
  const result = await pool.query(`SELECT l.*,u.nombre AS usuario_nombre,u.apellido AS usuario_apellido,u.email AS usuario_email,COUNT(*) OVER() AS total FROM logs_auditoria l LEFT JOIN usuarios u ON u.id=l.usuario_id WHERE ${filters.join(' AND ')} ORDER BY l.creado_en DESC LIMIT $${limitIndex} OFFSET $${offsetIndex}`, values);
  
  const items = result.rows.map(({ total, ...row }) => {
    // If the record has old technical values, convert them on the fly
    if (row.ruta && (row.ruta.startsWith('/') || row.ruta.startsWith('api'))) {
      const { friendlyRoute, friendlyAction } = getFriendlyRouteAndAction(
        { method: row.metodo || 'POST' },
        row.ruta,
        row.metodo || 'POST',
        row.entidad
      );
      row.ruta = friendlyRoute;
      row.accion = friendlyAction;
    }
    
    // Also format/sanitize metadata just in case
    if (row.metadata) {
      row.metadata = sanitizeValue(row.metadata);
    }
    
    return row;
  });

  return { items, total: Number(result.rows[0]?.total || 0), limit, offset };
}
module.exports = { list };
