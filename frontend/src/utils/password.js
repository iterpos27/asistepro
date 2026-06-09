const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const SYMBOLS = '!@#$%';

export function generateTemporaryPassword(length = 12) {
  const values = new Uint32Array(length);
  window.crypto.getRandomValues(values);

  const base = Array.from(values, (value) => CHARS[value % CHARS.length]);
  base[1] = SYMBOLS[values[0] % SYMBOLS.length];
  base[3] = String((values[1] % 9) + 1);
  return base.join('');
}
