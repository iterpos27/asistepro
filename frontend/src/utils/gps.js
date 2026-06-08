export function obtenerUbicacion(options = {}) {
  const config = {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 0,
    ...options,
  };

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu navegador no soporta GPS'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
          precision_metros: position.coords.accuracy,
        });
      },
      () => reject(new Error('No se pudo obtener la ubicacion GPS')),
      config,
    );
  });
}

export async function validarPermisoGPS() {
  if (!navigator.geolocation) {
    return {
      ok: false,
      estado: 'unsupported',
      message: 'Tu navegador no soporta GPS',
    };
  }

  if (!navigator.permissions?.query) {
    return {
      ok: true,
      estado: 'unknown',
      message: 'El navegador pedira permiso GPS al marcar',
    };
  }

  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });

    return {
      ok: permission.state !== 'denied',
      estado: permission.state,
      message:
        permission.state === 'denied'
          ? 'GPS bloqueado. Activa el permiso de ubicacion en el navegador.'
          : 'Permiso GPS disponible.',
    };
  } catch {
    return {
      ok: true,
      estado: 'unknown',
      message: 'El navegador pedira permiso GPS al marcar',
    };
  }
}
