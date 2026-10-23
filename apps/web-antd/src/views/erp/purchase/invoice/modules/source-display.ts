import { formatDateTime } from '@vben/utils';

const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export function formatPurchaseInvoiceSourceBizTime(
  value?: Date | number | string,
) {
  if (value === undefined || value === null || value === '') return '-';
  let normalized: Date | number | string = value;
  if (typeof value === 'string' && /^\d{10,13}$/.test(value)) {
    normalized = Number(value.length === 10 ? `${value}000` : value);
  } else if (typeof value === 'number' && value > 0 && value < 10_000_000_000) {
    normalized = value * 1000;
  }
  const formatted = formatDateTime(normalized);
  return DATE_TIME_PATTERN.test(formatted) ? formatted : '-';
}
