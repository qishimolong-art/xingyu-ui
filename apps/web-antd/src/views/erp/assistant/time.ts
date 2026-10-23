/** ERP local date-times have Beijing semantics; epoch/offset values are instants. */
export function formatAssistantTime(value?: null | number | string): string {
  if (value === undefined || value === null || value === '') return '—';
  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?)?$/.test(value)
  ) {
    return value.replace('T', ' ').replace(/\.\d+$/, '');
  }
  const date = new Date(
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  );
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}
