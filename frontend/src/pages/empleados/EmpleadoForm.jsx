import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const empleadoSchema = z.object({
  codigo: z.string().min(1, 'Codigo requerido'),
  nombres: z.string().min(1, 'Nombres requeridos'),
  apellidos: z.string().min(1, 'Apellidos requeridos'),
  email: z.union([z.string().email('Email invalido'), z.literal('')]).optional(),
  telefono: z.string().optional(),
  cargo: z.string().optional(),
  departamento: z.string().optional(),
  sucursal_habitual_id: z.string().optional(),
  fecha_ingreso: z.string().optional(),
  estado: z.enum(['activo', 'inactivo', 'suspendido']),
});

const defaultValues = {
  codigo: '',
  nombres: '',
  apellidos: '',
  email: '',
  telefono: '',
  cargo: '',
  departamento: '',
  sucursal_habitual_id: '',
  fecha_ingreso: '',
  estado: 'activo',
};

function dateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export default function EmpleadoForm({ empleado, sucursales, loading, onCancel, onSubmit }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(empleadoSchema),
    defaultValues,
  });

  useEffect(() => {
    reset(
      empleado
        ? {
            codigo: empleado.codigo || '',
            nombres: empleado.nombres || '',
            apellidos: empleado.apellidos || '',
            email: empleado.email || '',
            telefono: empleado.telefono || '',
            cargo: empleado.cargo || '',
            departamento: empleado.departamento || '',
            sucursal_habitual_id: empleado.sucursal_habitual_id || '',
            fecha_ingreso: dateOnly(empleado.fecha_ingreso),
            estado: empleado.estado || 'activo',
          }
        : defaultValues,
    );
  }, [empleado, reset]);

  function submit(values) {
    onSubmit({
      ...values,
      codigo: values.codigo.toUpperCase(),
      email: values.email || null,
      telefono: values.telefono || null,
      cargo: values.cargo || null,
      departamento: values.departamento || null,
      sucursal_habitual_id: values.sucursal_habitual_id || null,
      fecha_ingreso: values.fecha_ingreso || null,
    });
  }

  return (
    <form className="module-form" onSubmit={handleSubmit(submit)}>
      <div className="form-grid">
        <label>
          Codigo
          <input {...register('codigo')} placeholder="EMP001" />
          {errors.codigo && <small>{errors.codigo.message}</small>}
        </label>
        <label>
          Estado
          <select {...register('estado')}>
            <option value="activo">Activo</option>
            <option value="suspendido">Suspendido</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </label>
        <label>
          Nombres
          <input {...register('nombres')} placeholder="Juan Carlos" />
          {errors.nombres && <small>{errors.nombres.message}</small>}
        </label>
        <label>
          Apellidos
          <input {...register('apellidos')} placeholder="Perez Mora" />
          {errors.apellidos && <small>{errors.apellidos.message}</small>}
        </label>
        <label>
          Correo
          <input {...register('email')} type="email" placeholder="empleado@empresa.com" />
          {errors.email && <small>{errors.email.message}</small>}
        </label>
        <label>
          Telefono
          <input {...register('telefono')} placeholder="+593..." />
        </label>
        <label>
          Cargo
          <input {...register('cargo')} placeholder="Analista" />
        </label>
        <label>
          Departamento
          <input {...register('departamento')} placeholder="Operaciones" />
        </label>
        <label>
          Sucursal habitual
          <select {...register('sucursal_habitual_id')}>
            <option value="">Sin sucursal</option>
            {sucursales.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>
                {sucursal.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha ingreso
          <input {...register('fecha_ingreso')} type="date" />
        </label>
      </div>
      <div className="form-actions">
        <button className="outline-button" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="primary-button compact" disabled={loading}>
          {loading ? 'Guardando...' : empleado ? 'Actualizar' : 'Crear empleado'}
        </button>
      </div>
    </form>
  );
}
