import PanelTitle from '../../components/common/PanelTitle';

function dateOnly(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

export default function EmpleadoDetalle({ empleado, onClose }) {
  if (!empleado) return null;

  const details = [
    ['Codigo', empleado.codigo],
    ['Nombre', `${empleado.nombres || ''} ${empleado.apellidos || ''}`.trim()],
    ['Correo', empleado.email || '-'],
    ['Telefono', empleado.telefono || '-'],
    ['Cargo', empleado.cargo || '-'],
    ['Departamento', empleado.departamento || '-'],
    ['Sucursal habitual', empleado.sucursal_habitual_nombre || '-'],
    ['Usuario vinculado', empleado.usuario_email || '-'],
    ['Fecha ingreso', dateOnly(empleado.fecha_ingreso)],
    ['Estado', empleado.estado],
  ];

  return (
    <div className="panel">
      <PanelTitle title="Detalle de empleado" subtitle="Informacion laboral y contacto" />
      <div className="detail-grid">
        {details.map(([label, value]) => (
          <div key={label} className="detail-item">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button className="outline-button" type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
