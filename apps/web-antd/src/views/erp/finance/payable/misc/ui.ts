import type { ErpPayableMiscApi } from '#/api/erp/finance/payable/misc';

import { formatDateTime } from '@vben/utils';

import dayjs from 'dayjs';

function normalizeJavaLocalDateTime(value: unknown[]) {
  if (value.length < 3) return undefined;
  const parts = value.slice(0, 6).map(Number);
  while (parts.length < 6) parts.push(0);
  if (!parts.every((part) => Number.isInteger(part))) return undefined;

  const [year, month, day, hour, minute, second] = parts as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const parsed = new Date(year, month - 1, day, hour, minute, second);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute ||
    parsed.getSeconds() !== second
  ) {
    return undefined;
  }

  const date = [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
  return `${date} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

export function normalizePayableMiscDateTimeForPicker(value: unknown) {
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    value === 0 ||
    value === '0'
  ) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return normalizeJavaLocalDateTime(value);
  }

  const dateInput =
    typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value)
      : value;
  const parsed = dayjs(dateInput as dayjs.ConfigType);
  return parsed.isValid() ? formatDateTime(parsed) : undefined;
}

export function normalizePayableMiscFormValues(
  data: ErpPayableMiscApi.PayableMisc,
): ErpPayableMiscApi.PayableMisc {
  return {
    ...data,
    bizTime: normalizePayableMiscDateTimeForPicker(data.bizTime),
  };
}
