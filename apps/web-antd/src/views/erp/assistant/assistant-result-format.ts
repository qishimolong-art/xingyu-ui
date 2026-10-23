import type { ColumnType } from 'ant-design-vue/es/table';

import { businessTypeLabels } from '../stock/report/report-v2-ui';
import { formatAssistantTime } from './time';

type AssistantColumn = { dataIndex?: string; key: string; title: string };
type AssistantProtocolValue = {
  response?: {
    detail?: { available?: boolean; label?: string };
    message?: string;
    schemaVersion?: number;
  };
};

const TIME_FIELD_PATTERN = /(^|_)(date|time|day|at)$|(?:Date|Time|Day|At)$/;

const WIDTH_BY_KEY: Record<string, number> = {
  balance_quantity: 130,
  biz_date: 170,
  biz_no: 190,
  biz_type: 120,
  customer_name: 180,
  dept_name: 140,
  name: 180,
  no: 180,
  order_time: 170,
  product_name: 240,
  supplier_name: 180,
  unit: 90,
  warehouse_name: 170,
};

export function formatAssistantCell(value: unknown, field?: string): string {
  if (value === undefined || value === null || value === '') return '—';
  if (isBusinessTypeField(field)) {
    const numberValue = Number(value);
    return businessTypeLabels[numberValue] || `业务类型 ${value}`;
  }
  if (isTimeField(field)) return formatAssistantTime(value as number | string);
  return String(value);
}

export function assistantTableColumn(
  column: AssistantColumn,
): ColumnType<Record<string, unknown>> {
  const dataIndex = column.dataIndex || column.key;
  return {
    dataIndex,
    key: column.key,
    title: column.title,
    width: columnWidth(dataIndex, column.title),
    customRender: ({ text }: { text: unknown }) =>
      formatAssistantCell(text, dataIndex),
  };
}

export function assistantResponseMessage(
  value: AssistantProtocolValue | undefined,
  fallback: string,
): string {
  const message = value?.response?.message?.trim();
  return message || fallback;
}

export function assistantDetailAvailable(
  value: AssistantProtocolValue | undefined,
): boolean | undefined {
  if (!value?.response || value.response.schemaVersion !== 2) return undefined;
  return Boolean(value.response.detail?.available);
}

export function assistantDetailLabel(
  value: AssistantProtocolValue | undefined,
): string {
  return value?.response?.detail?.label || '查看来源明细';
}

function isBusinessTypeField(field?: string): boolean {
  return field === 'biz_type' || field === 'bizType';
}

function isTimeField(field?: string): boolean {
  return !!field && TIME_FIELD_PATTERN.test(field);
}

function columnWidth(field: string, title: string): number {
  if (WIDTH_BY_KEY[field]) return WIDTH_BY_KEY[field];
  if (field.endsWith('_id') || field === 'id') return 110;
  if (/产品|配件|单据|业务单号/.test(title)) return 190;
  if (/日期|时间/.test(title)) return 170;
  if (/数量|金额|库存/.test(title)) return 130;
  if (/单位/.test(title)) return 90;
  return 140;
}
