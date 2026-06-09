import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import * as empresaService from '../../services/empresaService';
import { EMPRESA_ID_KEY } from '../../utils/auth';

export default function EmpresaSelector() {
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState(() => localStorage.getItem(EMPRESA_ID_KEY) || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    empresaService
      .listEmpresas({ limit: 200 })
      .then((result) => {
        if (!mounted) return;
        const items = result.items || [];
        setEmpresas(items);

        const storedId = localStorage.getItem(EMPRESA_ID_KEY);
        if (storedId) {
          setEmpresaId(storedId);
          return;
        }

        if (items.length) {
          const nextId = items[0].id;
          setEmpresaId(nextId);
          localStorage.setItem(EMPRESA_ID_KEY, nextId);
        }
      })
      .catch(() => {
        if (mounted) setEmpresas([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  function handleChange(event) {
    const nextId = event.target.value;
    setEmpresaId(nextId);

    if (nextId) {
      localStorage.setItem(EMPRESA_ID_KEY, nextId);
    } else {
      localStorage.removeItem(EMPRESA_ID_KEY);
    }
  }

  return (
    <div className="empresa-selector">
      <Building2 size={16} />
      <select value={empresaId} onChange={handleChange} disabled={loading} aria-label="Empresa activa">
        <option value="">{loading ? 'Cargando empresas...' : 'Sin empresa'}</option>
        {empresas.map((empresa) => (
          <option key={empresa.id} value={empresa.id}>
            {empresa.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
