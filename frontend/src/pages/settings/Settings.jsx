import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import { useAuthContext } from '../../context/AuthContext';
import EmpresaSelector from '../../components/layout/EmpresaSelector';
import { ROLES, getRoleLabel } from '../../utils/roles';
import * as authService from '../../services/authService';
import * as empresaService from '../../services/empresaService';
import { toast } from '../../services/toastService';

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

const companySchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  identificacion_fiscal: z.string().optional(),
  email: z.union([z.string().email('Email invalido'), z.literal('')]).optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
});

function blobToObjectUrl(blob) {
  return URL.createObjectURL(blob);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export default function Settings() {
  const { user } = useAuthContext();
  const isSuperAdmin = user?.rol === ROLES.SUPER_ADMIN;
  const canManageCompany = user?.rol === ROLES.ADMIN_EMPRESA;
  const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' });
  const [companyStatus, setCompanyStatus] = useState({ type: '', message: '' });
  const [companyLoading, setCompanyLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoPayload, setLogoPayload] = useState(undefined);
  const [logoName, setLogoName] = useState('');

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const companyForm = useForm({
    resolver: zodResolver(companySchema),
    defaultValues: {
      nombre: '',
      identificacion_fiscal: '',
      email: '',
      telefono: '',
      direccion: '',
    },
  });

  async function submitPassword(values) {
    setPasswordStatus({ type: '', message: '' });
    try {
      const result = await authService.changePassword(values);
      passwordForm.reset();
      setPasswordStatus({
        type: 'success',
        message: result.message || 'Contrasena actualizada correctamente',
      });
      toast.success(result.message || 'Contrasena actualizada correctamente');
    } catch (error) {
      setPasswordStatus({
        type: 'error',
        message: error.response?.data?.message || 'No se pudo actualizar la contrasena',
      });
    }
  }

  async function loadCompany() {
    if (!canManageCompany) return;
    setCompanyLoading(true);
    setCompanyStatus({ type: '', message: '' });
    try {
      const empresa = await empresaService.getMiEmpresa();
      companyForm.reset({
        nombre: empresa.nombre || '',
        identificacion_fiscal: empresa.identificacion_fiscal || '',
        email: empresa.email || '',
        telefono: empresa.telefono || '',
        direccion: empresa.direccion || '',
      });

      if (logoPreview) {
        URL.revokeObjectURL(logoPreview);
      }

      if (empresa.tiene_logo) {
        try {
          const blob = await empresaService.getMiEmpresaLogo();
          setLogoPreview(blobToObjectUrl(blob));
          setLogoName(empresa.logo_nombre || 'logo-empresa');
        } catch {
          setLogoPreview('');
          setLogoName('');
        }
      } else {
        setLogoPreview('');
        setLogoName('');
      }
      setLogoPayload(undefined);
    } catch (error) {
      setCompanyStatus({
        type: 'error',
        message: error.response?.data?.message || 'No se pudo cargar la identidad de empresa',
      });
    } finally {
      setCompanyLoading(false);
    }
  }

  useEffect(() => {
    loadCompany();
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [canManageCompany]);

  async function handleLogoChange(file) {
    if (!file) {
      setLogoPayload(undefined);
      setLogoName('');
      return;
    }

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setCompanyStatus({ type: 'error', message: 'El logo debe ser PNG o JPG' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setCompanyStatus({ type: 'error', message: 'El logo no puede superar 2MB' });
      return;
    }

    const dataBase64 = await fileToBase64(file);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(URL.createObjectURL(file));
    setLogoName(file.name);
    setLogoPayload({
      nombre: file.name,
      tipo: file.type,
      data_base64: dataBase64,
    });
    setCompanyStatus({ type: '', message: '' });
  }

  async function submitCompany(values) {
    setCompanyLoading(true);
    setCompanyStatus({ type: '', message: '' });
    try {
      const payload = {
        nombre: values.nombre,
        identificacion_fiscal: values.identificacion_fiscal || null,
        email: values.email || null,
        telefono: values.telefono || null,
        direccion: values.direccion || null,
        ...(logoPayload ? { logo: logoPayload } : {}),
      };
      await empresaService.updateMiEmpresa(payload);
      setCompanyStatus({ type: 'success', message: 'Identidad de empresa actualizada correctamente' });
      toast.success('Identidad de empresa actualizada correctamente');
      await loadCompany();
    } catch (error) {
      setCompanyStatus({
        type: 'error',
        message: error.response?.data?.message || 'No se pudo actualizar la identidad de empresa',
      });
    } finally {
      setCompanyLoading(false);
    }
  }

  const companyHasLogo = useMemo(() => Boolean(logoPreview), [logoPreview]);

  return (
    <>
      <PageHeader title="Ajustes" description="Informacion de tu cuenta, seguridad e identidad de empresa." />

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
        <form className="module-form" onSubmit={passwordForm.handleSubmit(submitPassword)}>
          <div className="form-grid">
            <label>
              Contrasena actual
              <input {...passwordForm.register('currentPassword')} type="password" autoComplete="current-password" />
              {passwordForm.formState.errors.currentPassword && <small>{passwordForm.formState.errors.currentPassword.message}</small>}
            </label>
            <label>
              Nueva contrasena
              <input {...passwordForm.register('newPassword')} type="password" autoComplete="new-password" />
              {passwordForm.formState.errors.newPassword && <small>{passwordForm.formState.errors.newPassword.message}</small>}
            </label>
            <label>
              Confirmar nueva contrasena
              <input {...passwordForm.register('confirmPassword')} type="password" autoComplete="new-password" />
              {passwordForm.formState.errors.confirmPassword && <small>{passwordForm.formState.errors.confirmPassword.message}</small>}
            </label>
          </div>
          {passwordStatus.message ? (
            <p className={passwordStatus.type === 'success' ? 'alert-success compact-alert' : 'alert-error compact-alert'}>
              {passwordStatus.message}
            </p>
          ) : null}
          <div className="form-actions">
            <button className="primary-button compact" disabled={passwordForm.formState.isSubmitting}>
              {passwordForm.formState.isSubmitting ? 'Actualizando...' : 'Cambiar contrasena'}
            </button>
          </div>
        </form>
      </div>

      {canManageCompany ? (
        <div className="panel">
          <PanelTitle title="Identidad de empresa" subtitle="Estos datos se usan en reportes, PDF y documentos generados por AsistePro." />
          <form className="module-form" onSubmit={companyForm.handleSubmit(submitCompany)}>
            <div className="form-grid">
              <label>
                Nombre empresa
                <input {...companyForm.register('nombre')} />
                {companyForm.formState.errors.nombre && <small>{companyForm.formState.errors.nombre.message}</small>}
              </label>
              <label>
                Identificacion fiscal
                <input {...companyForm.register('identificacion_fiscal')} placeholder="RUC / RFC / NIT" />
              </label>
              <label>
                Email empresa
                <input {...companyForm.register('email')} type="email" />
                {companyForm.formState.errors.email && <small>{companyForm.formState.errors.email.message}</small>}
              </label>
              <label>
                Telefono
                <input {...companyForm.register('telefono')} />
              </label>
              <label className="wide-field">
                Direccion
                <input {...companyForm.register('direccion')} />
              </label>
              <label className="wide-field">
                Logo corporativo (PNG o JPG)
                <input type="file" accept="image/png,image/jpeg" onChange={(event) => handleLogoChange(event.target.files?.[0])} />
                <small>Maximo 2MB. Este logo se mostrara en los PDF generados por AsistePro.</small>
              </label>
            </div>

            {companyHasLogo ? (
              <div className="identity-logo-preview">
                <div className="identity-logo-card">
                  <img src={logoPreview} alt="Logo de empresa" />
                </div>
                <div className="identity-logo-meta">
                  <strong>{logoName || 'Logo cargado'}</strong>
                  <span className="table-subtext">Se usara en exportes PDF y documentos internos.</span>
                </div>
              </div>
            ) : null}

            {companyStatus.message ? (
              <p className={companyStatus.type === 'success' ? 'alert-success compact-alert' : 'alert-error compact-alert'}>
                {companyStatus.message}
              </p>
            ) : null}

            <div className="form-actions">
              <button className="outline-button" type="button" onClick={loadCompany} disabled={companyLoading}>
                {companyLoading ? 'Cargando...' : 'Recargar datos'}
              </button>
              <button className="primary-button compact" disabled={companyLoading}>
                {companyLoading ? 'Guardando...' : 'Guardar identidad'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isSuperAdmin ? (
        <div className="panel">
          <PanelTitle title="Contexto de empresa" subtitle="Selecciona la empresa con la que operaras en modulos tenant." />
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
