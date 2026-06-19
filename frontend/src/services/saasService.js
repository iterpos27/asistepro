import { api } from './api';

export async function getOverview() {
  const response = await api.get('/saas/overview');
  return response.data.data;
}

export async function listTenants() {
  const response = await api.get('/saas/tenants');
  return response.data.data;
}
