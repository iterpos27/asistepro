function toRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateDistanceMeters(origin, destination) {
  const earthRadiusMeters = 6371000;
  const lat1 = toRadians(Number(origin.latitud));
  const lat2 = toRadians(Number(destination.latitud));
  const deltaLat = toRadians(Number(destination.latitud) - Number(origin.latitud));
  const deltaLng = toRadians(Number(destination.longitud) - Number(origin.longitud));

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

module.exports = {
  calculateDistanceMeters,
};
