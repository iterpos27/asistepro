import { useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, DatabaseZap, Download, Wallet } from 'lucide-react';
import MetricCard from '../../components/cards/MetricCard';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import * as saasService from '../../services/saasService';

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function downloadCsv(rows) {
  const columns = ['nombre', 'plan_nombre', 'total_empleados', 'total_sucursales', 'marcaciones_mes', 'saldo_pendiente', 'facturas_vencidas'];
  const csv = [columns.join(',')]
    .concat(rows.map((row) => columns.map((column) => `"${String(row[column] ?? '')}"`).join(',')))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'saas-tenants.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function SaasControl() {
  const [overview, setOverview] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [overviewResult, tenantsResult] = await Promise.all([
        saasService.getOverview(),
        saasService.listTenants(),
      ]);
      setOverview(overviewResult);
      setTenants(tenantsResult || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <>
      <PageHeader
        title="Panel SaaS y cobranza"
        description="Consumo por tenant, riesgos de plan y cuentas por cobrar antes de impactar soporte o facturacion."
        actions={
          <button className="outline-button" type="button" onClick={() => downloadCsv(tenants)}>
            <Download size={16} />
            Exportar
          </button>
        }
      />

      <section className="metrics-grid">
        <MetricCard label="Empresas activas" value={overview?.resumen?.empresas_activas || 0} icon={DatabaseZap} />
        <MetricCard label="MRR" value={money(overview?.resumen?.mrr)} icon={Wallet} tone="success" />
        <MetricCard label="Pendiente" value={money(overview?.resumen?.saldo_pendiente)} icon={CreditCard} tone="warning" />
        <MetricCard label="Vencidas" value={overview?.resumen?.facturas_vencidas || 0} icon={AlertTriangle} tone="warning" />
      </section>

      <div className="dashboard-split">
        <div className="panel">
          <PanelTitle title="Distribucion por planes" subtitle="Base activa agrupada por suscripcion." />
          <div className="stack-list">
            {(overview?.planes || []).map((plan) => (
              <div className="list-row" key={plan.codigo}>
                <strong>{plan.nombre}</strong>
                <span>{plan.total} tenants</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <PanelTitle title="Riesgos operativos" subtitle="Alertas para soporte, cobro y capacidad." />
          <div className="stack-list">
            <div className="list-row"><strong>Limite critico</strong><span>{overview?.riesgos?.con_limite_critico || 0}</span></div>
            <div className="list-row"><strong>Cobranza pendiente</strong><span>{overview?.riesgos?.con_cobro_pendiente || 0}</span></div>
            <div className="list-row"><strong>Baja actividad</strong><span>{overview?.riesgos?.con_baja_actividad || 0}</span></div>
          </div>
        </div>
      </div>

      <div className="panel">
        <PanelTitle title="Tenants monitoreados" subtitle="Uso real contra limites contratados e indicadores de cobranza." />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Plan</th>
                <th>Empleados</th>
                <th>Sucursales</th>
                <th>Marcaciones mes</th>
                <th>Saldo pendiente</th>
                <th>Riesgos</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length ? tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>{tenant.nombre}</td>
                  <td>{tenant.plan_nombre || '-'}</td>
                  <td>{tenant.total_empleados} / {tenant.limite_empleados ?? 'I'}</td>
                  <td>{tenant.total_sucursales} / {tenant.limite_sucursales ?? 'I'}</td>
                  <td>{tenant.marcaciones_mes}</td>
                  <td>{money(tenant.saldo_pendiente)}</td>
                  <td>
                    <div className="risk-tags">
                      {tenant.riesgo_limite_empleados && <span className="status-pill warning">Empleados</span>}
                      {tenant.riesgo_limite_sucursales && <span className="status-pill warning">Sucursales</span>}
                      {tenant.riesgo_cobranza && <span className="status-pill warning">Cobranza</span>}
                      {tenant.riesgo_importaciones && <span className="status-pill muted">Imports</span>}
                      {tenant.riesgo_integraciones && <span className="status-pill muted">Integraciones</span>}
                      {tenant.riesgo_storage && <span className="status-pill muted">Storage</span>}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="7">{loading ? 'Cargando...' : 'Sin tenants para mostrar.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
