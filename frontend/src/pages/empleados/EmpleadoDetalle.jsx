import { useState } from 'react';
import PanelTitle from '../../components/common/PanelTitle';
import * as empleadoService from '../../services/empleadoService';
import { toast } from '../../services/toastService';

function dateOnly(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

function money(value) {
  if (value === null || value === undefined || value === '') return '-';
  return `$${Number(value).toFixed(2)}`;
}

function fullName(empleado) {
  return `${empleado?.nombres || ''} ${empleado?.apellidos || ''}`.trim() || '-';
}

function supervisorName(empleado) {
  const names = `${empleado?.supervisor_nombres || ''} ${empleado?.supervisor_apellidos || ''}`.trim();
  if (!names) return '-';
  return empleado?.supervisor_codigo ? `${empleado.supervisor_codigo} - ${names}` : names;
}

function renderDetailSection(title, items) {
  return (
    <section className="panel embedded-panel">
      <PanelTitle title={title} />
      <div className="detail-grid">
        {items.map(([label, value]) => (
          <div key={label} className="detail-item">
            <span>{label}</span>
            <strong>{value || '-'}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function EmpleadoDetalle({ empleado, onClose, onDeviceReleased }) {
  const [loadingDevice, setLoadingDevice] = useState(false);

  if (!empleado) return null;

  const personal = [
    ['Codigo', empleado.codigo],
    ['Nombre', fullName(empleado)],
    ['Correo', empleado.email || empleado.usuario_email || '-'],
    ['Telefono', empleado.telefono || '-'],
    ['Estado', empleado.estado],
    ['Fecha ingreso', dateOnly(empleado.fecha_ingreso)],
  ];

  const laboral = [
    ['Cargo libre', empleado.cargo || '-'],
    ['Departamento libre', empleado.departamento || '-'],
    ['Tipo contrato', empleado.tipo_contrato || '-'],
    ['Salario base', money(empleado.salario_base)],
    ['Sucursal habitual', empleado.sucursal_habitual_nombre || '-'],
    ['Supervisor', supervisorName(empleado)],
  ];

  const estructura = [
    ['Area', empleado.area_nombre || '-'],
    ['Cargo estructurado', empleado.cargo_estructura_nombre || '-'],
    ['Centro de costo', empleado.centro_costo_nombre || '-'],
    ['Usuario vinculado', empleado.usuario_email || '-'],
    ['Dispositivo UUID', empleado.dispositivo_uuid || 'Ninguno (Libre)'],
  ];

  async function handleLiberar() {
    if (!window.confirm('¿Confirmas liberar el dispositivo vinculado de este empleado? El empleado podrá volver a registrarse desde otro celular.')) return;
    setLoadingDevice(true);
    try {
      await empleadoService.liberarDispositivo(empleado.id);
      toast.success('Dispositivo liberado correctamente');
      if (onDeviceReleased) onDeviceReleased();
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo liberar el dispositivo');
    } finally {
      setLoadingDevice(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel detail-modal" onClick={(event) => event.stopPropagation()}>
        <PanelTitle title="Ficha del empleado" subtitle="Informacion personal, laboral y de estructura organizacional" />

        <div className="detail-summary">
          <div className="detail-summary-card">
            <span className="detail-summary-label">Empleado</span>
            <strong>{fullName(empleado)}</strong>
            <span className="table-subtext">{empleado.codigo}</span>
          </div>
          <div className="detail-summary-card">
            <span className="detail-summary-label">Contrato</span>
            <strong>{empleado.tipo_contrato || 'Sin definir'}</strong>
            <span className="table-subtext">{money(empleado.salario_base)}</span>
          </div>
          <div className="detail-summary-card">
            <span className="detail-summary-label">Supervisor</span>
            <strong>{supervisorName(empleado)}</strong>
            <span className="table-subtext">{empleado.sucursal_habitual_nombre || 'Sin sucursal habitual'}</span>
          </div>
        </div>

        <div className="detail-sections">
          {renderDetailSection('Datos personales', personal)}
          {renderDetailSection('Contexto laboral', laboral)}
          {renderDetailSection('Estructura y acceso', estructura)}
        </div>

        <div className="form-actions">
          {empleado.dispositivo_uuid && (
            <button className="primary-button compact warning-button" type="button" onClick={handleLiberar} disabled={loadingDevice} style={{ background: '#eab308', borderColor: '#eab308' }}>
              {loadingDevice ? 'Liberando...' : 'Liberar celular'}
            </button>
          )}
          <button className="outline-button" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
