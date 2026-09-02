export function preparePilotFile(text, serial, fecha) {
  const saved = JSON.parse(text);
  if (saved.version !== 1 || saved.serial !== serial || !saved.records || Array.isArray(saved.records)
    || typeof saved.records !== 'object') throw new Error('El archivo no pertenece a la serie registrada o no es un piloto valido.');
  const records = Object.values(saved.records).filter(r => typeof r?.localTime === 'string' && r.localTime.slice(0, 10) === fecha)
    .map(({ userId, localTime, status, verification }) => ({ userId, localTime, status, verification }));
  if (!records.length) throw new Error('El archivo no contiene marcaciones para la fecha seleccionada.');
  if (records.length > 1000) throw new Error('La fecha contiene mas de 1000 registros; requiere una carga administrada.');
  return { serial, payload: { records } };
}
