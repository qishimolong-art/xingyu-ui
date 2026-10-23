import dayjs from 'dayjs';

/**
 * 格式化配件盈亏明细表日期。
 *
 * 后端 LocalDateTime 默认可能返回毫秒时间戳；数字时间戳不能先转成字符串，
 * 否则 dayjs 会把前四位误识别成年份（例如 1790... 会显示为 1794 年）。
 */
export function formatStockProfitLossDetailReportDate(value: unknown) {
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
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : '-';
}
