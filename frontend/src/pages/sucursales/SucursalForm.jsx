import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink, LocateFixed, MapPin } from 'lucide-react';

const coordinateField = (label, min, max) =>
  z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.coerce.number({ message: `${label} requerida` }).refine((value) => value >= min && value <= max, `${label} inválida`),
  );

const sucursalSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  codigo: z.string().min(1, 'Código requerido'),
  direccion: z.string().optional(),
  ciudad: z.string().optional(),
  latitud: coordinateField('Latitud', -90, 90),
  longitud: coordinateField('Longitud', -180, 180),
  radio_metros: z.coerce.number().int().min(1, 'Radio requerido'),
  estado: z.enum(['activa', 'inactiva', 'mantenimiento']),
  jefe_empleado_id: z.string().optional().nullable(),
});

const defaultValues = {
  nombre: '',
  codigo: '',
  direccion: '',
  ciudad: '',
  latitud: '',
  longitud: '',
  radio_metros: 100,
  estado: 'activa',
  jefe_empleado_id: '',
};

export default function SucursalForm({ sucursal, employees = [], loading, onCancel, onSubmit }) {
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMessage, setGeoMessage] = useState('');
  const [mapInput, setMapInput] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(sucursalSchema),
    defaultValues,
  });
  const latitud = watch('latitud');
  const longitud = watch('longitud');
  const mapUrl = useMemo(() => {
    const hasLatitud = latitud !== '' && latitud !== null && latitud !== undefined;
    const hasLongitud = longitud !== '' && longitud !== null && longitud !== undefined;
    const lat = Number(latitud);
    const lng = Number(longitud);
    const query = hasLatitud && hasLongitud && Number.isFinite(lat) && Number.isFinite(lng) ? `${lat},${lng}` : 'Quito Ecuador';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }, [latitud, longitud]);

  useEffect(() => {
    reset(
      sucursal
        ? {
            nombre: sucursal.nombre || '',
            codigo: sucursal.codigo || '',
            direccion: sucursal.direccion || '',
            ciudad: sucursal.ciudad || '',
            latitud: Number(sucursal.latitud || 0),
            longitud: Number(sucursal.longitud || 0),
            radio_metros: Number(sucursal.radio_metros || 100),
            estado: sucursal.estado || 'activa',
            jefe_empleado_id: sucursal.jefe_empleado_id || '',
          }
        : defaultValues,
    );
  }, [reset, sucursal]);

  function submit(values) {
    onSubmit({
      ...values,
      codigo: values.codigo.toUpperCase(),
      direccion: values.direccion || null,
      ciudad: values.ciudad || null,
      jefe_empleado_id: values.jefe_empleado_id || null,
    });
  }

  function applyCoordinates(lat, lng, message) {
    setValue('latitud', Number(lat.toFixed(7)), { shouldDirty: true, shouldValidate: true });
    setValue('longitud', Number(lng.toFixed(7)), { shouldDirty: true, shouldValidate: true });
    setGeoMessage(message);
  }

  function useCurrentLocation() {
    setGeoMessage('');

    if (!navigator.geolocation) {
      setGeoMessage('Este navegador no permite obtener la ubicación.');
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyCoordinates(
          position.coords.latitude,
          position.coords.longitude,
          `Ubicación obtenida con precisión aproximada de ${Math.round(position.coords.accuracy)} m.`,
        );
        setGeoLoading(false);
      },
      () => {
        setGeoMessage('No se pudo obtener la ubicación. Revisa permisos del navegador o pega un enlace del mapa.');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 12000 },
    );
  }

  function parseMapCoordinates(value) {
    const decoded = decodeURIComponent(value.trim());
    const patterns = [
      /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
      /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
    ];

    for (const pattern of patterns) {
      const match = decoded.match(pattern);
      if (match) {
        const lat = Number(match[1]);
        const lng = Number(match[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng };
        }
      }
    }

    return null;
  }

  function applyMapInput() {
    const coordinates = parseMapCoordinates(mapInput);
    if (!coordinates) {
      setGeoMessage('No encontré coordenadas válidas en el texto ingresado.');
      return;
    }

    applyCoordinates(coordinates.lat, coordinates.lng, 'Coordenadas aplicadas desde el mapa.');
  }

  return (
    <form className="module-form" onSubmit={handleSubmit(submit)}>
      <div className="form-grid">
        <label>
          Nombre
          <input {...register('nombre')} placeholder="Matriz" />
          {errors.nombre && <small>{errors.nombre.message}</small>}
        </label>
        <label>
          Código
          <input {...register('codigo')} placeholder="MAT" />
          {errors.codigo && <small>{errors.codigo.message}</small>}
        </label>
        <label className="wide-field">
          Dirección
          <input {...register('direccion')} placeholder="Av. principal y calle secundaria" />
        </label>
        <label>
          Ciudad
          <input {...register('ciudad')} placeholder="Quito" />
        </label>
        <label>
          Radio metros
          <input {...register('radio_metros')} type="number" min="1" />
          {errors.radio_metros && <small>{errors.radio_metros.message}</small>}
        </label>
        <label>
          Latitud
          <input {...register('latitud')} type="number" step="0.0000001" placeholder="-0.180653" />
          {errors.latitud && <small>{errors.latitud.message}</small>}
        </label>
        <label>
          Longitud
          <input {...register('longitud')} type="number" step="0.0000001" placeholder="-78.467834" />
          {errors.longitud && <small>{errors.longitud.message}</small>}
        </label>
        <div className="location-tool wide-field">
          <div className="location-tool-header">
            <span className="location-icon">
              <MapPin size={18} />
            </span>
            <div>
              <strong>Ubicación geográfica</strong>
              <span>Usa GPS o pega coordenadas/enlace del mapa.</span>
            </div>
          </div>
          <div className="location-actions">
            <button className="outline-button" type="button" onClick={useCurrentLocation} disabled={geoLoading}>
              <LocateFixed size={16} />
              {geoLoading ? 'Obteniendo...' : 'Usar ubicacion actual'}
            </button>
            <a className="outline-button" href={mapUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} />
              Elegir en mapa
            </a>
          </div>
          <div className="location-map-input">
            <input
              value={mapInput}
              onChange={(event) => setMapInput(event.target.value)}
              placeholder="Pega enlace de Google Maps, OpenStreetMap o -0.180653,-78.467834"
            />
            <button className="outline-button" type="button" onClick={applyMapInput}>
              Aplicar coordenadas
            </button>
          </div>
          {geoMessage ? <small className="location-status">{geoMessage}</small> : null}
        </div>
        <label>
          Jefe de Almacén
          <select {...register('jefe_empleado_id')}>
            <option value="">Sin jefe asignado</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.codigo} - {emp.nombres} {emp.apellidos}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select {...register('estado')}>
            <option value="activa">Activa</option>
            <option value="mantenimiento">Mantenimiento</option>
            <option value="inactiva">Inactiva</option>
          </select>
        </label>
      </div>
      <div className="form-actions">
        <button className="outline-button" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="primary-button compact" disabled={loading}>
          {loading ? 'Guardando...' : sucursal ? 'Actualizar' : 'Crear sucursal'}
        </button>
      </div>
    </form>
  );
}
