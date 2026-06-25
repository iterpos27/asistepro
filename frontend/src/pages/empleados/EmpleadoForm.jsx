import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { generateTemporaryPassword } from '../../utils/password';

const contractTypes = ['Indefinido', 'Temporal', 'Por horas', 'Servicios profesionales', 'Pasantia'];

const empleadoSchema = z
  .object({
    codigo: z.string().optional(),
    nombres: z.string().min(1, 'Nombres requeridos'),
    apellidos: z.string().min(1, 'Apellidos requeridos'),
    email: z.union([z.string().email('Email invalido'), z.literal('')]).optional(),
    telefono: z.string().optional(),
    cedula: z.string().optional(),
    username: z.union([z.string().regex(/^[a-z0-9._-]+$/, 'Solo letras minúsculas, números, puntos, guiones').min(3).max(30), z.literal('')]).optional(),
    dispositivo_uuid: z.string().optional(),
    cargo: z.string().optional(),
    departamento: z.string().optional(),
    sucursal_habitual_id: z.string().optional(),
    fecha_ingreso: z.string().optional(),
    estado: z.enum(['activo', 'inactivo', 'suspendido']),
    area_estructura_id: z.string().optional(),
    cargo_estructura_id: z.string().optional(),
    centro_costo_estructura_id: z.string().optional(),
    supervisor_empleado_id: z.string().optional(),
    tipo_contrato: z.string().optional(),
    salario_base: z.union([z.coerce.number().min(0, 'Salario no puede ser negativo'), z.literal('')]).optional(),
    crear_usuario: z.boolean().optional(),
    rol_acceso: z.enum(['EMPLEADO', 'RRHH']).optional(),
    password_acceso: z.string().optional(),
  })
  .superRefine((values, context) => {
    if (!values.crear_usuario) return;

    if (!values.email) {
      context.addIssue({
        code: 'custom',
        path: ['email'],
        message: 'Correo requerido para crear usuario',
      });
    }

    if (!values.password_acceso || values.password_acceso.length < 8) {
      context.addIssue({
        code: 'custom',
        path: ['password_acceso'],
        message: 'Mínimo 8 caracteres',
      });
    }
  });

const defaultValues = {
  codigo: '',
  nombres: '',
  apellidos: '',
  email: '',
  telefono: '',
  cedula: '',
  username: '',
  dispositivo_uuid: '',
  cargo: '',
  departamento: '',
  sucursal_habitual_id: '',
  fecha_ingreso: '',
  estado: 'activo',
  area_estructura_id: '',
  cargo_estructura_id: '',
  centro_costo_estructura_id: '',
  supervisor_empleado_id: '',
  tipo_contrato: '',
  salario_base: '',
  crear_usuario: false,
  rol_acceso: 'EMPLEADO',
  password_acceso: '',
};

function dateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function getStructuresByType(catalogs, allowedTypes) {
  return (catalogs?.estructuras || []).filter((item) => allowedTypes.includes(item.tipo));
}

export default function EmpleadoForm({ empleado, sucursales, catalogs, supervisors, loading, onCancel, onSubmit }) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
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
            cedula: empleado.cedula || '',
            username: empleado.username || '',
            dispositivo_uuid: empleado.dispositivo_uuid || '',
            cargo: empleado.cargo || '',
            departamento: empleado.departamento || '',
            sucursal_habitual_id: empleado.sucursal_habitual_id || '',
            fecha_ingreso: dateOnly(empleado.fecha_ingreso),
            estado: empleado.estado || 'activo',
            area_estructura_id: empleado.area_estructura_id || '',
            cargo_estructura_id: empleado.cargo_estructura_id || '',
            centro_costo_estructura_id: empleado.centro_costo_estructura_id || '',
            supervisor_empleado_id: empleado.supervisor_empleado_id || '',
            tipo_contrato: empleado.tipo_contrato || '',
            salario_base: empleado.salario_base ?? '',
            crear_usuario: false,
            rol_acceso: 'EMPLEADO',
            password_acceso: '',
          }
        : defaultValues,
    );
  }, [empleado, reset]);

  const createAccess = watch('crear_usuario');
  const hasLinkedUser = Boolean(empleado?.usuario_id || empleado?.usuario_email);
  const areaOptions = getStructuresByType(catalogs, ['direccion', 'departamento', 'area', 'unidad']);
  const cargoOptions = getStructuresByType(catalogs, ['cargo']);
  const centroCostoOptions = getStructuresByType(catalogs, ['centro_costo']);

  function submit(values) {
    onSubmit({
      ...values,
      codigo: empleado ? values.codigo : undefined,
      email: values.email || null,
      telefono: values.telefono || null,
      cedula: values.cedula || null,
      username: values.username || null,
      dispositivo_uuid: values.dispositivo_uuid || null,
      cargo: values.cargo || null,
      departamento: values.departamento || null,
      sucursal_habitual_id: values.sucursal_habitual_id || null,
      fecha_ingreso: values.fecha_ingreso || null,
      area_estructura_id: values.area_estructura_id || null,
      cargo_estructura_id: values.cargo_estructura_id || null,
      centro_costo_estructura_id: values.centro_costo_estructura_id || null,
      supervisor_empleado_id: values.supervisor_empleado_id || null,
      tipo_contrato: values.tipo_contrato || null,
      salario_base: values.salario_base === '' || values.salario_base === null || values.salario_base === undefined ? null : Number(values.salario_base),
      crear_usuario: hasLinkedUser ? false : Boolean(values.crear_usuario),
      rol_acceso: values.crear_usuario ? values.rol_acceso || 'EMPLEADO' : undefined,
      password_acceso: values.crear_usuario ? values.password_acceso : undefined,
    });
  }

  function generateAccessPassword() {
    setValue('password_acceso', generateTemporaryPassword(), {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

  return (
    <form className="module-form" onSubmit={handleSubmit(submit)}>
      <div className="form-grid">
        <label>
          Código
          <input 
            {...register('codigo')} 
            placeholder={empleado ? undefined : 'Se generará automáticamente'} 
            readOnly 
            style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
          />
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
          Cédula / C.I.
          <input {...register('cedula')} placeholder="Ej. 1792948271" />
        </label>
        <label>
          Username (para login)
          <input {...register('username')} placeholder="juan.perez" style={{ textTransform: 'lowercase' }} />
          {errors.username && <small>{errors.username.message}</small>}
          <small style={{ color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>Solo letras minúsculas, números, puntos y guiones. Mín. 3 caracteres.</small>
        </label>
        {empleado && (
          <label className="wide-field">
            Bloqueo de Dispositivo (UUID)
            <div className="input-action-row" style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <input 
                {...register('dispositivo_uuid')} 
                readOnly 
                placeholder="Sin registrar (se vinculará automáticamente en la primera marcación)" 
                style={{ background: '#f1f5f9', cursor: 'not-allowed', flexGrow: 1 }}
              />
              {watch('dispositivo_uuid') && (
                <button 
                  className="outline-button" 
                  type="button" 
                  onClick={() => setValue('dispositivo_uuid', '', { shouldDirty: true, shouldValidate: true })}
                  style={{ whiteSpace: 'nowrap', color: '#dc2626', borderColor: '#fca5a5' }}
                >
                  Liberar Dispositivo
                </button>
              )}
            </div>
          </label>
        )}
        <label>
          Correo
          <input {...register('email')} type="email" placeholder="empleado@empresa.com" />
          {errors.email && <small>{errors.email.message}</small>}
        </label>
        <label>
          Teléfono
          <input {...register('telefono')} placeholder="+593..." />
        </label>
        <label>
          Cargo libre
          <input {...register('cargo')} placeholder="Analista" />
        </label>
        <label>
          Departamento libre
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
        <label>
          Tipo contrato
          <select {...register('tipo_contrato')}>
            <option value="">Sin definir</option>
            {contractTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Salario base
          <input {...register('salario_base')} type="number" min="0" step="0.01" placeholder="0.00" />
          {errors.salario_base && <small>{errors.salario_base.message}</small>}
        </label>
        <label>
          Área estructurada
          <select {...register('area_estructura_id')}>
            <option value="">Sin asignar</option>
            {areaOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cargo estructurado
          <select {...register('cargo_estructura_id')}>
            <option value="">Sin asignar</option>
            {cargoOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Centro de costo
          <select {...register('centro_costo_estructura_id')}>
            <option value="">Sin asignar</option>
            {centroCostoOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Supervisor
          <select {...register('supervisor_empleado_id')}>
            <option value="">Sin supervisor</option>
            {supervisors
              .filter((item) => item.id !== empleado?.id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.codigo} - {item.nombres} {item.apellidos}
                </option>
              ))}
          </select>
        </label>
        {hasLinkedUser ? (
          <label className="wide-field">
            Usuario vinculado
            <input value={empleado.usuario_email || 'Usuario activo'} readOnly />
          </label>
        ) : (
          <>
            <label className="checkbox-field wide-field">
              <input {...register('crear_usuario')} type="checkbox" />
              Crear usuario de acceso y asignar rol del sistema
            </label>
            {createAccess ? (
              <>
                <label>
                  Rol del empleado
                  <select {...register('rol_acceso')}>
                    <option value="EMPLEADO">Empleado</option>
                    <option value="RRHH">RRHH</option>
                  </select>
                  <small>RRHH podrá administrar asistencia según permisos asignados en Ajustes.</small>
                </label>
                <label>
                  Contraseña temporal
                  <div className="input-action-row">
                    <input {...register('password_acceso')} type="text" placeholder="Mínimo 8 caracteres" />
                    <button className="outline-button" type="button" onClick={generateAccessPassword}>
                      Generar
                    </button>
                  </div>
                  {errors.password_acceso && <small>{errors.password_acceso.message}</small>}
                </label>
              </>
            ) : null}
          </>
        )}
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
