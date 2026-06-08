import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const facturaSchema = z.object({
  empresa_id: z.string().min(1, 'Empresa requerida'),
  suscripcion_id: z.string().optional(),
  numero: z.string().optional(),
  concepto: z.string().min(1, 'Concepto requerido'),
  subtotal: z.coerce.number().min(0, 'Subtotal invalido'),
  impuesto: z.coerce.number().min(0, 'Impuesto invalido'),
  total: z.coerce.number().min(0, 'Total invalido'),
  estado: z.enum(['pendiente', 'pagada', 'vencida']),
  fecha_emision: z.string().min(1, 'Fecha requerida'),
  fecha_vencimiento: z.string().optional(),
});

const defaultValues = {
  empresa_id: '',
  suscripcion_id: '',
  numero: '',
  concepto: '',
  subtotal: 0,
  impuesto: 0,
  total: 0,
  estado: 'pendiente',
  fecha_emision: new Date().toISOString().slice(0, 10),
  fecha_vencimiento: '',
};

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

export default function FacturaForm({ factura, empresas, suscripciones, loading, onCancel, onSubmit }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(facturaSchema),
    defaultValues,
  });

  const subtotal = watch('subtotal');
  const impuesto = watch('impuesto');
  const empresaId = watch('empresa_id');
  const availableSuscripciones = suscripciones.filter((suscripcion) => !empresaId || suscripcion.empresa_id === empresaId);

  useEffect(() => {
    reset(
      factura
        ? {
            empresa_id: factura.empresa_id || '',
            suscripcion_id: factura.suscripcion_id || '',
            numero: factura.numero || '',
            concepto: factura.concepto || '',
            subtotal: Number(factura.subtotal || 0),
            impuesto: Number(factura.impuesto || 0),
            total: Number(factura.total || 0),
            estado: factura.estado === 'anulada' ? 'pendiente' : factura.estado || 'pendiente',
            fecha_emision: dateOnly(factura.fecha_emision) || defaultValues.fecha_emision,
            fecha_vencimiento: dateOnly(factura.fecha_vencimiento),
          }
        : defaultValues,
    );
  }, [factura, reset]);

  useEffect(() => {
    const nextTotal = Number(subtotal || 0) + Number(impuesto || 0);
    setValue('total', Number(nextTotal.toFixed(2)), { shouldValidate: true });
  }, [subtotal, impuesto, setValue]);

  function submit(values) {
    onSubmit({
      ...values,
      suscripcion_id: values.suscripcion_id || null,
      numero: values.numero || undefined,
      fecha_vencimiento: values.fecha_vencimiento || null,
    });
  }

  return (
    <form className="module-form" onSubmit={handleSubmit(submit)}>
      <div className="form-grid">
        <label>
          Empresa
          <select {...register('empresa_id')} disabled={Boolean(factura)}>
            <option value="">Selecciona empresa</option>
            {empresas.map((empresa) => (
              <option key={empresa.id} value={empresa.id}>
                {empresa.nombre}
              </option>
            ))}
          </select>
          {errors.empresa_id && <small>{errors.empresa_id.message}</small>}
        </label>
        <label>
          Suscripcion
          <select {...register('suscripcion_id')}>
            <option value="">Sin suscripcion</option>
            {availableSuscripciones.map((suscripcion) => (
              <option key={suscripcion.id} value={suscripcion.id}>
                {suscripcion.empresa_nombre} - {suscripcion.plan_nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Numero
          <input {...register('numero')} placeholder="Automatico" disabled={Boolean(factura)} />
        </label>
        <label>
          Estado
          <select {...register('estado')}>
            <option value="pendiente">Pendiente</option>
            <option value="pagada">Pagada</option>
            <option value="vencida">Vencida</option>
          </select>
        </label>
        <label className="wide-field">
          Concepto
          <input {...register('concepto')} placeholder="Suscripcion mensual" />
          {errors.concepto && <small>{errors.concepto.message}</small>}
        </label>
        <label>
          Subtotal
          <input {...register('subtotal')} type="number" min="0" step="0.01" />
        </label>
        <label>
          Impuesto
          <input {...register('impuesto')} type="number" min="0" step="0.01" />
        </label>
        <label>
          Total
          <input {...register('total')} type="number" min="0" step="0.01" />
        </label>
        <label>
          Emision
          <input {...register('fecha_emision')} type="date" />
          {errors.fecha_emision && <small>{errors.fecha_emision.message}</small>}
        </label>
        <label>
          Vencimiento
          <input {...register('fecha_vencimiento')} type="date" />
        </label>
      </div>
      <div className="form-actions">
        <button className="outline-button" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="primary-button compact" disabled={loading}>
          {loading ? 'Guardando...' : factura ? 'Actualizar factura' : 'Crear factura'}
        </button>
      </div>
    </form>
  );
}
