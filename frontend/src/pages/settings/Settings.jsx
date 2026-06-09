import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import { useAuthContext } from '../../context/AuthContext';
import EmpresaSelector from '../../components/layout/EmpresaSelector';
import { ROLES, getRoleLabel } from '../../utils/roles';
import * as authService from '../../services/authService';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Contrasena actual requerida'),
    newPassword: z.string().min(8, 'Minimo 8 caracteres'),
    confirmPassword: z.string().min(8, 'Confirma la nueva contrasena'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Las contrasenas no coinciden',
    path: ['confirmPassword'],
  });

export default function Settings() {
  const { user } = useAuthContext();
  const isSuperAdmin = user?.rol === ROLES.SUPER_ADMIN;
  const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  async function submitPassword(values) {
    setPasswordStatus({ type: '', message: '' });
    try {
      const result = await authService.changePassword(values);
      reset();
      setPasswordStatus({
        type: 'success',
        message: result.message || 'Contrasena actualizada correctamente',
      });
    } catch (error) {
      setPasswordStatus({
        type: 'error',
        message: error.response?.data?.message || 'No se pudo actualizar la contrasena',
      });
    }
  }

  return (
    <>
      <PageHeader title="Ajustes" description="Informacion de tu cuenta y contexto de trabajo." />

      <div className="panel">
        <PanelTitle title="Perfil" subtitle="Datos de la sesion actual" />
        <div className="settings-grid">
          <label>
            Nombre
            <input readOnly value={user?.nombre ? `${user.nombre} ${user.apellido || ''}`.trim() : '-'} />
          </label>
          <label>
            Email
            <input readOnly value={user?.email || ''} />
          </label>
          <label>
            Rol
            <input readOnly value={getRoleLabel(user?.rol)} />
          </label>
          <label>
            Empresa
            <input readOnly value={user?.empresa || (isSuperAdmin ? 'Plataforma (sin tenant fijo)' : '-')} />
          </label>
        </div>
      </div>

      <div className="panel">
        <PanelTitle title="Seguridad" subtitle="Actualiza la contrasena de acceso a tu cuenta." />
        <form className="module-form" onSubmit={handleSubmit(submitPassword)}>
          <div className="form-grid">
            <label>
              Contrasena actual
              <input {...register('currentPassword')} type="password" autoComplete="current-password" />
              {errors.currentPassword && <small>{errors.currentPassword.message}</small>}
            </label>
            <label>
              Nueva contrasena
              <input {...register('newPassword')} type="password" autoComplete="new-password" />
              {errors.newPassword && <small>{errors.newPassword.message}</small>}
            </label>
            <label>
              Confirmar nueva contrasena
              <input {...register('confirmPassword')} type="password" autoComplete="new-password" />
              {errors.confirmPassword && <small>{errors.confirmPassword.message}</small>}
            </label>
          </div>
          {passwordStatus.message ? (
            <p className={passwordStatus.type === 'success' ? 'alert-success compact-alert' : 'alert-error compact-alert'}>
              {passwordStatus.message}
            </p>
          ) : null}
          <div className="form-actions">
            <button className="primary-button compact" disabled={isSubmitting}>
              {isSubmitting ? 'Actualizando...' : 'Cambiar contrasena'}
            </button>
          </div>
        </form>
      </div>

      {isSuperAdmin ? (
        <div className="panel">
          <PanelTitle
            title="Contexto de empresa"
            subtitle="Selecciona la empresa con la que operaras en modulos tenant."
          />
          <div className="settings-selector">
            <EmpresaSelector />
          </div>
          <p className="helper-text">
            El super admin necesita una empresa activa para consultar sucursales, empleados y marcaciones de un tenant.
          </p>
        </div>
      ) : null}
    </>
  );
}
