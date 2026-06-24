import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const dias = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
];

const horarioSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  descripcion: z.string().optional(),
  sucursal_id: z.string().optional(),
  dias_semana: z.array(z.string()).min(1, 'Selecciona al menos un día'),
  hora_inicio: z.string().min(1, 'Hora entrada requerida'),
  hora_fin: z.string().min(1, 'Hora salida requerida'),
  tolerancia_minutos: z.coerce.number().int().min(0, 'No puede ser negativa'),
  descanso_minutos: z.coerce.number().int().min(0, 'No puede ser negativo'),
  activo: z.boolean(),
});

const defaultValues = {
  nombre: '',
  descripcion: '',
  sucursal_id: '',
  dias_semana: ['1', '2', '3', '4', '5'],
  hora_inicio: '08:00',
  hora_fin: '17:00',
  tolerancia_minutos: 10,
  descanso_minutos: 0,
  activo: true,
};

function timeOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

export default function HorarioForm({ horario, sucursales, loading, onCancel, onSubmit }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(horarioSchema),
    defaultValues,
  });

  useEffect(() => {
    reset(
      horario
        ? {
            nombre: horario.nombre || '',
            descripcion: horario.descripcion || '',
            sucursal_id: horario.sucursal_id || '',
            dias_semana: (horario.dias_semana || []).map(String),
            hora_inicio: timeOnly(horario.hora_inicio),
            hora_fin: timeOnly(horario.hora_fin),
            tolerancia_minutos: Number(horario.tolerancia_minutos || 0),
            descanso_minutos: Number(horario.descanso_minutos || 0),
            activo: Boolean(horario.activo),
          }
        : defaultValues,
    );
  }, [horario, reset]);

  function submit(values) {
    onSubmit({
      ...values,
      sucursal_id: values.sucursal_id || null,
      descripcion: values.descripcion || null,
      dias_semana: values.dias_semana.map(Number),
    });
  }

  return (
    <form className="module-form" onSubmit={handleSubmit(submit)}>
      <div className="form-grid">
        <label>
          Nombre
          <input {...register('nombre')} placeholder="Turno oficina" />
          {errors.nombre && <small>{errors.nombre.message}</small>}
        </label>
        <label>
          Sucursal
          <select {...register('sucursal_id')}>
            <option value="">Todas / sin sucursal fija</option>
            {sucursales.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>
                {sucursal.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="wide-field">
          Descripción
          <input {...register('descripcion')} placeholder="Horario regular administrativo" />
        </label>
        <label>
          Hora entrada
          <input {...register('hora_inicio')} type="time" />
          {errors.hora_inicio && <small>{errors.hora_inicio.message}</small>}
        </label>
        <label>
          Hora salida
          <input {...register('hora_fin')} type="time" />
          {errors.hora_fin && <small>{errors.hora_fin.message}</small>}
        </label>
        <label>
          Tolerancia minutos
          <input {...register('tolerancia_minutos')} type="number" min="0" />
          {errors.tolerancia_minutos && <small>{errors.tolerancia_minutos.message}</small>}
        </label>
        <label>
          Descanso minutos
          <input {...register('descanso_minutos')} type="number" min="0" />
          {errors.descanso_minutos && <small>{errors.descanso_minutos.message}</small>}
        </label>
        <div className="wide-field">
          <span className="field-label">Días laborales</span>
          <div className="day-picker">
            {dias.map((dia) => (
              <label key={dia.value}>
                <input {...register('dias_semana')} type="checkbox" value={String(dia.value)} />
                {dia.label}
              </label>
            ))}
          </div>
          {errors.dias_semana && <small className="field-error">{errors.dias_semana.message}</small>}
        </div>
        <label className="checkbox-field">
          <input {...register('activo')} type="checkbox" />
          Activo
        </label>
      </div>
      <div className="form-actions">
        <button className="outline-button" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="primary-button compact" disabled={loading}>
          {loading ? 'Guardando...' : horario ? 'Actualizar' : 'Crear horario'}
        </button>
      </div>
    </form>
  );
}
