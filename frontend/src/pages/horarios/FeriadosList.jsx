import { useEffect, useState } from 'react';
import { CalendarPlus, Trash2, Star } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import * as service from '../../services/feriadoService';
import { toast } from '../../services/toastService';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const feriadoSchema = z.object({
  nombre: z.string().min(1, 'Nombre del feriado requerido').max(100),
  fecha: z.string().min(1, 'Fecha requerida'),
  descripcion: z.string().optional(),
});

const currentYear = new Date().getFullYear();

function FeriadoForm({ loading, onSubmit, onCancel }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(feriadoSchema),
    defaultValues: { nombre: '', fecha: '', descripcion: '' },
  });

  function submit(values) {
    onSubmit({ ...values, descripcion: values.descripcion || null });
    reset();
  }

  return (
    <form className="module-form" onSubmit={handleSubmit(submit)}>
      <div className="form-grid">
        <label>
          Nombre del feriado
          <input {...register('nombre')} placeholder="Ej: Navidad, Año Nuevo..." />
          {errors.nombre && <small>{errors.nombre.message}</small>}
        </label>
        <label>
          Fecha
          <input {...register('fecha')} type="date" />
          {errors.fecha && <small>{errors.fecha.message}</small>}
        </label>
        <label className="wide-field">
          Descripción (opcional)
          <input {...register('descripcion')} placeholder="Descripción adicional del feriado" />
        </label>
      </div>
      <div className="form-actions">
        {onCancel && <button className="outline-button" type="button" onClick={onCancel}>Cancelar</button>}
        <button className="primary-button compact" disabled={loading}>
          {loading ? 'Guardando...' : 'Agregar feriado'}
        </button>
      </div>
    </form>
  );
}

export default function FeriadosList() {
  const [feriados, setFeriados] = useState([]);
  const [year, setYear] = useState(String(currentYear));
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const result = await service.listFeriados({ anio: year });
      setFeriados(Array.isArray(result) ? result : result?.items || []);
    } catch {
      toast.error('No se pudieron cargar los feriados');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [year]);

  async function handleCreate(payload) {
    setSaving(true);
    try {
      await service.createFeriado(payload);
      toast.success('Feriado agregado');
      setShowForm(false);
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Error al guardar el feriado');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, nombre) {
    if (!window.confirm(`¿Eliminar el feriado "${nombre}"?`)) return;
    try {
      await service.deleteFeriado(id);
      toast.success('Feriado eliminado');
      await load();
    } catch {
      toast.error('Error al eliminar el feriado');
    }
  }

  const months = [...new Set(feriados.map((f) => f.fecha?.slice(0, 7)))].sort();

  return (
    <>
      <PageHeader
        title="Feriados"
        description="Administra los días feriados de la empresa. Los feriados no generan descuentos ni se contabilizan como ausencias."
        actions={
          <>
            <select value={year} onChange={(e) => setYear(e.target.value)} style={{ width: '100px' }}>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
            <button className="primary-button compact" onClick={() => setShowForm((v) => !v)}>
              <CalendarPlus size={16} /> {showForm ? 'Cancelar' : 'Agregar feriado'}
            </button>
          </>
        }
      />

      {showForm && (
        <div className="panel" style={{ marginBottom: '1.5rem' }}>
          <PanelTitle title="Nuevo feriado" subtitle="Complete los datos del feriado a registrar" />
          <FeriadoForm loading={saving} onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {feriados.length === 0 && !loading ? (
        <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <Star size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-muted)' }}>No hay feriados registrados para el año {year}.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Agrega los feriados nacionales y locales que aplican a tu empresa.</p>
        </div>
      ) : (
        months.map((month) => {
          const monthFeriados = feriados.filter((f) => f.fecha?.startsWith(month));
          const monthLabel = new Date(month + '-15').toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
          return (
            <div key={month} className="panel" style={{ marginBottom: '1rem' }}>
              <PanelTitle title={monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)} subtitle={`${monthFeriados.length} feriado${monthFeriados.length !== 1 ? 's' : ''}`} />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Nombre</th>
                      <th>Descripción</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthFeriados.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span style={{ fontWeight: '600' }}>
                            {new Date(item.fecha + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </span>
                        </td>
                        <td>
                          <span className="status-pill" style={{ background: '#dbeafe', color: '#1d4ed8', borderColor: '#93c5fd' }}>
                            <Star size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                            {item.nombre}
                          </span>
                        </td>
                        <td>{item.descripcion || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                        <td>
                          <button
                            className="icon-button"
                            style={{ color: '#dc2626' }}
                            aria-label="Eliminar feriado"
                            onClick={() => handleDelete(item.id, item.nombre)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
