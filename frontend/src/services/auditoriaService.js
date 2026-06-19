import { api } from './api';
export async function listAuditoria(params = {}) { const response = await api.get('/auditoria', { params }); return response.data.data; }
export async function exportarAuditoria(params = {}) { const response=await api.get('/auditoria/export',{params,responseType:'blob'});const url=URL.createObjectURL(response.data);const link=document.createElement('a');link.href=url;link.download='auditoria.csv';link.click();URL.revokeObjectURL(url); }
