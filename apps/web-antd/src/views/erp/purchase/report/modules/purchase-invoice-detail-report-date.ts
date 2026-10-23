import dayjs from 'dayjs';

/**
 * 格式化采购票据明细报表日期。
 *
 * 后端的 LocalDateTime 默认返回毫秒时间戳，LocalDate 返回日期字符串；
 * 两种格式都需要兼容，不能先把数字时间戳转换成字符串再交给 dayjs。
 */
export function formatPurchaseInvoiceDetailReportDate(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';

  let normalizedValue = value;
  if (typeof value === 'string' && /^\d{10,13}$/.test(value)) {
    normalizedValue = Number(value) * (value.length === 10 ? 1000 : 1);
  } else if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) < 100_000_000_000
  ) {
    normalizedValue = value * 1000;
  }
  const parsed = dayjs(normalizedValue as Parameters<typeof dayjs>[0]);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '-';
}
