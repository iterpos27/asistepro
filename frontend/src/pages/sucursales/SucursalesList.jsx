import { useEffect, useState } from 'react';
import { Edit, Plus, QrCode, RotateCcw, Search, Trash2 } from 'lucide-react';
import ActionDialog from '../../components/common/ActionDialog';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import * as sucursalService from '../../services/sucursalService';
import SucursalForm from './SucursalForm';
import SucursalQR from './SucursalQR';

function statusClass(estado) {
  if (estado === 'activa') return 'status-pill';
  if (estado === 'mantenimiento') return 'status-pill warning';
  return 'status-pill muted';
}

export default function SucursalesList() {
  const [sucursales, setSucursales] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [selectedSucursal, setSelectedSucursal] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingDeactivate, setPendingDeactivate] = useState(null);

  async function loadSucursales() {
    setLoading(true);
    setError('');

    try {
      const result = await sucursalService.listSucursales({ search, estado, limit: 100 });
      setSucursales(result.items || []);
      setTotal(result.total || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudieron cargar las sucursales');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSucursales();
  }, []);

  function openCreateForm() {
    setSelectedSucursal(null);
    setShowForm(true);
    setQrData(null);
    setMessage('');
    setError('');
  }

  function openEditForm(sucursal) {
    setSelectedSucursal(sucursal);
    setShowForm(true);
    setQrData(null);
    setMessage('');
    setError('');
  }

  function closeForm() {
    setSelectedSucursal(null);
    setShowForm(false);
  }

  async function saveSucursal(values) {
    setFormLoading(true);
    setError('');

    try {
      if (selectedSucursal) {
        await sucursalService.updateSucursal(selectedSucursal.id, values);
        setMessage('Sucursal actualizada correctamente');
      } else {
        await sucursalService.createSucursal(values);
        setMessage('Sucursal creada correctamente');
      }

      closeForm();
      await loadSucursales();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo guardar la sucursal');
    } finally {
      setFormLoading(false);
    }
  }

  async function deactivateSucursal(sucursal) {
    setMessage('');
    setError('');

    try {
      await sucursalService.deleteSucursal(sucursal.id);
      setMessage('Sucursal desactivada correctamente');
      setPendingDeactivate(null);
      await loadSucursales();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo desactivar la sucursal');
    }
  }

  async function showQr(sucursal) {
    setQrLoading(true);
    setQrData(null);
    setError('');

    try {
      setSelectedSucursal(sucursal);
      setQrData(await sucursalService.getSucursalQr(sucursal.id));
      setShowForm(false);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo cargar el QR');
    } finally {
      setQrLoading(false);
    }
  }

  async function rotateQr() {
    if (!selectedSucursal) return;

    setQrLoading(true);
    setError('');

    try {
      setQrData(await sucursalService.rotateSucursalQr(selectedSucursal.id));
      setMessage('QR rotado correctamente');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo rotar el QR');
    } finally {
      setQrLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Sucursales"
        description="Ubicaciones, geocercas y QR por empresa."
        actions={
          <>
            <span className="status-pill">{loading ? 'Cargando' : `${total} registros`}</span>
            <button className="outline-button" type="button" onClick={openCreateForm}>
              <Plus size={16} />
              Nueva sucursal
            </button>
          </>
        }
      />

      <div className="panel">
        <PanelTitle title="Filtros" subtitle="Busca por nombre, codigo o ciudad" />
        <div className="toolbar-grid">
          <label className="search-box inline-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar sucursal" />
          </label>
          <select value={estado} onChange={(event) => setEstado(event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="activa">Activa</option>
            <option value="mantenimiento">Mantenimiento</option>
            <option value="inactiva">Inactiva</option>
          </select>
          <button className="outline-button" type="button" onClick={loadSucursales}>
            <RotateCcw size={16} />
            Aplicar
          </button>
        </div>
      </div>

      {message ? <div className="alert-success">{message}</div> : null}
      {error ? <div className="alert-error">{error}</div> : null}

      <ActionDialog
        open={Boolean(pendingDeactivate)}
        danger
        title="Desactivar sucursal"
        message={`Se desactivara "${pendingDeactivate?.nombre || ''}". Las marcaciones futuras no deberian usar esta sede.`}
        confirmLabel="Desactivar"
        onCancel={() => setPendingDeactivate(null)}
        onConfirm={() => deactivateSucursal(pendingDeactivate)}
      />

      {showForm ? (
        <div className="panel">
          <PanelTitle title={selectedSucursal ? 'Editar sucursal' : 'Nueva sucursal'} subtitle="Direccion, coordenadas, radio y estado" />
          <SucursalForm sucursal={selectedSucursal} loading={formLoading} onCancel={closeForm} onSubmit={saveSucursal} />
        </div>
      ) : null}

      <SucursalQR qrData={qrData} loading={qrLoading} onRotate={rotateQr} />

      <div className="panel">
        <PanelTitle title="Sucursales registradas" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Codigo</th>
                <th>Ciudad</th>
                <th>Radio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sucursales.length ? (
                sucursales.map((sucursal) => (
                  <tr key={sucursal.id}>
                    <td>{sucursal.nombre}</td>
                    <td>{sucursal.codigo}</td>
                    <td>{sucursal.ciudad || '-'}</td>
                    <td>{sucursal.radio_metros} m</td>
                    <td>
                      <span className={statusClass(sucursal.estado)}>{sucursal.estado}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button" type="button" onClick={() => openEditForm(sucursal)} aria-label="Editar sucursal">
                          <Edit size={16} />
                        </button>
                        <button className="icon-button" type="button" onClick={() => showQr(sucursal)} aria-label="Ver QR">
                          <QrCode size={16} />
                        </button>
                        <button className="icon-button danger" type="button" onClick={() => setPendingDeactivate(sucursal)} aria-label="Desactivar sucursal">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">Sin sucursales para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
