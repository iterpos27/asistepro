import { api } from './api';

export async function listPermisosUsuarios() {
  const response = await api.get('/usuarios/permisos');
  return response.data.data;
}

export async function updatePermisosUsuario(id, modulos) {
  const response = await api.put(`/usuarios/${id}/permisos`, { modulos });
  return response.data.data;
}

export async function listRolesPersonalizados() { const response=await api.get('/usuarios/roles-personalizados'); return response.data.data; }
export async function createRolPersonalizado(payload) { const response=await api.post('/usuarios/roles-personalizados',payload); return response.data.data; }
export async function updateRolPersonalizado(id,payload) { const response=await api.put(`/usuarios/roles-personalizados/${id}`,payload); return response.data.data; }
export async function assignRolPersonalizado(id,rol_personalizado_id,permisos={}) { const response=await api.put(`/usuarios/${id}/rol-personalizado`,{rol_personalizado_id,permisos}); return response.data.data; }
