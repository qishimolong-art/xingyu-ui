import type { ErpReceivableOtherIncomeApi } from '#/api/erp/finance/receivable/other-income';

import dayjs from 'dayjs';

function toOtherIncomeAmount(value: unknown) {
  return Number(value || 0);
}

export function formatOtherIncomeAmount(value: unknown) {
  return toOtherIncomeAmount(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function getOtherIncomePageSummary(
  rows: ErpReceivableOtherIncomeApi.OtherIncome[],
) {
  return {
    documentCount: rows.length,
    totalAmount: rows.reduce(
      (sum, row) => sum + toOtherIncomeAmount(row.totalAmount),
      0,
    ),
  };
}

function normalizeLocalDateTimeArray(value: unknown[]) {
  if (value.length < 3) return undefined;
  const [year, month, day, hour = 0, minute = 0, second = 0] = value;
  if (
    ![year, month, day, hour, minute, second].every((item) =>
      Number.isInteger(item),
    )
  ) {
    return undefined;
  }
  return dayjs(
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(
      2,
      '0',
    )} ${String(hour).padStart(2, '0')}:${String(minute).padStart(
      2,
      '0',
    )}:${String(second).padStart(2, '0')}`,
  );
}

function normalizeDayjsInput(value: unknown) {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    value instanceof Date ||
    dayjs.isDayjs(value)
  ) {
    return value;
  }
  return undefined;
}

export function normalizeOtherIncomeBizTime(value: unknown) {
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    value === 0 ||
    value === '0'
  ) {
    return undefined;
  }

  const parsed = Array.isArray(value)
    ? normalizeLocalDateTimeArray(value)
    : dayjs(
        typeof value === 'string' && /^\d+$/.test(value.trim())
          ? Number(value)
          : normalizeDayjsInput(value),
      );

  return parsed?.isValid() && parsed.valueOf() > 0
    ? parsed.valueOf()
    : undefined;
}

export function normalizeOtherIncomeBizTimeForPicker(value: unknown) {
  const timestamp = normalizeOtherIncomeBizTime(value);
  return timestamp === undefined ? undefined : String(timestamp);
}

/** 子表直接使用 Ant Design DatePicker，需按它的 valueFormat 传入格式化字符串。 */
export function normalizeOtherIncomeItemBizDateForPicker(value: unknown) {
  const timestamp = normalizeOtherIncomeBizTime(value);
  return timestamp === undefined
    ? undefined
    : dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
}

export function normalizeOtherIncomeListRow(
  row: ErpReceivableOtherIncomeApi.OtherIncome,
): ErpReceivableOtherIncomeApi.OtherIncome {
  const bizTime = normalizeOtherIncomeBizTime(row.bizTime);
  return {
    ...row,
    bizTime: bizTime ?? row.bizTime,
    auditorName: row.status === 20 ? row.updaterName : undefined,
    auditTime:
      row.status === 20 ? (row.approveTime ?? row.updateTime) : undefined,
  };
}
