import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { EMPRESA_CHANGED_EVENT } from '../utils/auth';

export default function useResource(path, fallback, deps = [], options = {}) {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(false);
  const [tenantVersion, setTenantVersion] = useState(0);

  useEffect(() => {
    function handleEmpresaChange() {
      setTenantVersion((version) => version + 1);
    }

    window.addEventListener(EMPRESA_CHANGED_EVENT, handleEmpresaChange);
    return () => window.removeEventListener(EMPRESA_CHANGED_EVENT, handleEmpresaChange);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setData(fallback);
      setLoading(false);
      return undefined;
    }

    let mounted = true;
    setLoading(true);
    api
      .get(path)
      .then((response) => {
        if (mounted) setData(response.data.data);
      })
      .catch(() => {
        if (mounted) setData(fallback);
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [enabled, path, tenantVersion, ...deps]);

  return { data, loading };
}
