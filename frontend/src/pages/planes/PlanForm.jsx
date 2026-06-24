import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const numberField = z.coerce.number().min(0, 'No puede ser negativo');
const optionalLimit = z.union([z.coerce.number().int().min(0), z.literal('')]).optional();

const planSchema = z.object({
  codigo: z.string().min(1, 'Código requerido'),
  nombre: z.string().min(1, 'Nombre requerido'),
  descripcion: z.string().optional(),
  precio_mensual: numberField,
  limite_empleados: optionalLimit,
  limite_sucursales: optionalLimit,
  activo: z.boolean(),
});

const defaultValues = {
  codigo: '',
  nombre: '',
  descripcion: '',
  precio_mensual: 0,
  limite_empleados: '',
  limite_sucursales: '',
  activo: true,
};

export default function PlanForm({ plan, loading, onCancel, onSubmit }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(planSchema),
    defaultValues,
  });

  useEffect(() => {
    reset(
      plan
        ? {
            codigo: plan.codigo || '',
            nombre: plan.nombre || '',
            descripcion: plan.descripcion || '',
            precio_mensual: Number(plan.precio_mensual || 0),
            limite_empleados: plan.limite_empleados ?? '',
            limite_sucursales: plan.limite_sucursales ?? '',
            activo: Boolean(plan.activo),
          }
        : defaultValues,
    );
  }, [plan, reset]);

  function submit(values) {
    onSubmit({
      ...values,
      codigo: values.codigo.toLowerCase(),
      descripcion: values.descripcion || null,
      limite_empleados: values.limite_empleados === '' ? null : Number(values.limite_empleados),
      limite_sucursales: values.limite_sucursales === '' ? null : Number(values.limite_sucursales),
    });
  }

  return (
    <form className="module-form" onSubmit={handleSubmit(submit)}>
      <div className="form-grid">
        <label>
          Código
          <input {...register('codigo')} placeholder="pyme" />
          {errors.codigo && <small>{errors.codigo.message}</small>}
        </label>
        <label>
          Nombre
          <input {...register('nombre')} placeholder="Pyme" />
          {errors.nombre && <small>{errors.nombre.message}</small>}
        </label>
        <label className="wide-field">
          Descripción
          <input {...register('descripcion')} placeholder="Plan para equipos en crecimiento" />
        </label>
        <label>
          Precio mensual
          <input {...register('precio_mensual')} type="number" min="0" step="0.01" />
          {errors.precio_mensual && <small>{errors.precio_mensual.message}</small>}
        </label>
        <label>
          Límite empleados
          <input {...register('limite_empleados')} type="number" min="0" placeholder="Sin límite" />
        </label>
        <label>
          Límite sucursales
          <input {...register('limite_sucursales')} type="number" min="0" placeholder="Sin límite" />
        </label>
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
          {loading ? 'Guardando...' : plan ? 'Actualizar' : 'Crear plan'}
        </button>
      </div>
    </form>
  );
}
