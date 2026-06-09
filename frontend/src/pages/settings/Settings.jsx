import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import { useAuthContext } from '../../context/AuthContext';
import EmpresaSelector from '../../components/layout/EmpresaSelector';
import { ROLES, getRoleLabel } from '../../utils/roles';

export default function Settings() {
  const { user } = useAuthContext();
  const isSuperAdmin = user?.rol === ROLES.SUPER_ADMIN;

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
