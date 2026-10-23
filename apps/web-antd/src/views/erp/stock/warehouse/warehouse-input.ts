/** Keep decimal editing states in the control; validate only when saving. */
export function parseWarehouseNumber(value: unknown, limit?: number) {
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  const pattern =
    limit === undefined ? /^-?\d+$/u : /^-?(?:\d+(?:\.\d{0,6})?|\.\d{1,6})$/u;
  if (!pattern.test(text)) return Number.NaN;
  const number = Number(text);
  if (!Number.isFinite(number)) return Number.NaN;
  if (limit === undefined)
    return Number.isSafeInteger(number) ? number : Number.NaN;
  return Math.abs(number) <= limit ? number : Number.NaN;
}

export function formatWarehouseCoordinate(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toFixed(6).replace(/\.?0+$/u, '')
    : String(value);
}
