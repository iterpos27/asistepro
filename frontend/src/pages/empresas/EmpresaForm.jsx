import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { generateTemporaryPassword } from '../../utils/password';

const empresaSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  identificacion_fiscal: z.string().optional(),
  email: z.union([z.string().email('Email invalido'), z.literal('')]).optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  estado: z.enum(['activa', 'suspendida', 'cancelada']),
  admin_nombre: z.string().optional(),
  admin_apellido: z.string().optional(),
  admin_email: z.union([z.string().email('Email invalido'), z.literal('')]).optional(),
  admin_telefono: z.string().optional(),
  admin_password: z.string().optional(),
  admin_confirm_password: z.string().optional(),
}).superRefine((values, ctx) => {
  if (!values.admin_email && !values.admin_password && !values.admin_confirm_password) return;

  if (!values.admin_email) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Email del admin requerido', path: ['admin_email'] });
  }

  if (!values.admin_password || values.admin_password.length < 8) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Minimo 8 caracteres', path: ['admin_password'] });
  }

  if (values.admin_password !== values.admin_confirm_password) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Las contrasenas no coinciden', path: ['admin_confirm_password'] });
  }
});

const defaultValues = {
  nombre: '',
  identificacion_fiscal: '',
  email: '',
  telefono: '',
  direccion: '',
  estado: 'activa',
  admin_nombre: '',
  admin_apellido: '',
  admin_email: '',
  admin_telefono: '',
  admin_password: '',
  admin_confirm_password: '',
};

export default function EmpresaForm({ empresa, loading, onCancel, onSubmit }) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(empresaSchema),
    defaultValues,
  });

  useEffect(() => {
    reset(
      empresa
        ? {
            nombre: empresa.nombre || '',
            identificacion_fiscal: empresa.identificacion_fiscal || '',
            email: empresa.email || '',
            telefono: empresa.telefono || '',
            direccion: empresa.direccion || '',
            estado: empresa.estado || 'activa',
            admin_nombre: '',
            admin_apellido: '',
            admin_email: '',
            admin_telefono: '',
            admin_password: '',
            admin_confirm_password: '',
          }
        : defaultValues,
    );
  }, [empresa, reset]);

  function submit(values) {
    onSubmit({
      ...values,
      identificacion_fiscal: values.identificacion_fiscal || null,
      email: values.email || null,
      telefono: values.telefono || null,
      direccion: values.direccion || null,
      admin_nombre: values.admin_email ? values.admin_nombre || null : undefined,
      admin_apellido: values.admin_email ? values.admin_apellido || null : undefined,
      admin_email: values.admin_email || undefined,
      admin_telefono: values.admin_email ? values.admin_telefono || null : undefined,
      admin_password: values.admin_email ? values.admin_password : undefined,
      admin_confirm_password: values.admin_email ? values.admin_confirm_password : undefined,
    });
  }

  function generateAdminPassword() {
    const password = generateTemporaryPassword();
    setValue('admin_password', password, { shouldValidate: true, shouldDirty: true });
    setValue('admin_confirm_password', password, { shouldValidate: true, shouldDirty: true });
  }

  return (
    <form className="module-form" onSubmit={handleSubmit(submit)}>
      <div className="form-grid">
        <label>
          Nombre
          <input {...register('nombre')} placeholder="Empresa demo" />
          {errors.nombre && <small>{errors.nombre.message}</small>}
        </label>
        <label>
          Identificacion fiscal
          <input {...register('identificacion_fiscal')} placeholder="RUC / RFC / NIT" />
        </label>
        <label>
          Email
          <input {...register('email')} type="email" placeholder="admin@empresa.com" />
          {errors.email && <small>{errors.email.message}</small>}
        </label>
        <label>
          Telefono
          <input {...register('telefono')} placeholder="+593..." />
        </label>
        <label className="wide-field">
          Direccion
          <input {...register('direccion')} placeholder="Direccion principal" />
        </label>
        <label>
          Estado
          <select {...register('estado')}>
            <option value="activa">Activa</option>
            <option value="suspendida">Suspendida</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </label>
      </div>
      {!empresa ? (
        <div className="form-section">
          <div className="form-section-title">
            <strong>Administrador de la empresa</strong>
            <span>Este usuario podra entrar al panel y crear accesos para RRHH y empleados.</span>
          </div>
          <div className="form-grid">
            <label>
              Nombre admin
              <input {...register('admin_nombre')} placeholder="Nombre" />
            </label>
            <label>
              Apellido admin
              <input {...register('admin_apellido')} placeholder="Apellido" />
            </label>
            <label>
              Email admin
              <input {...register('admin_email')} type="email" placeholder="admin@empresa.com" />
              {errors.admin_email && <small>{errors.admin_email.message}</small>}
            </label>
            <label>
              Telefono admin
              <input {...register('admin_telefono')} placeholder="+593..." />
            </label>
            <label>
              Contrasena inicial
              <div className="input-action-row">
                <input {...register('admin_password')} type="text" placeholder="Minimo 8 caracteres" />
                <button className="outline-button" type="button" onClick={generateAdminPassword}>
                  Generar
                </button>
              </div>
              {errors.admin_password && <small>{errors.admin_password.message}</small>}
            </label>
            <label>
              Confirmar contrasena
              <input {...register('admin_confirm_password')} type="password" placeholder="Repite la contrasena" />
              {errors.admin_confirm_password && <small>{errors.admin_confirm_password.message}</small>}
            </label>
          </div>
        </div>
      ) : null}
      <div className="form-actions">
        <button className="outline-button" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="primary-button compact" disabled={loading}>
          {loading ? 'Guardando...' : empresa ? 'Actualizar' : 'Crear empresa'}
        </button>
      </div>
    </form>
  );
}
