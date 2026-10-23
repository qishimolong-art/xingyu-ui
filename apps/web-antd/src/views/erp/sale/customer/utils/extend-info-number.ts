import {
  formatOptionalNumberInput,
  toOptionalNumberValue,
} from '#/views/erp/sale/utils/text-number';

type CustomerExtendNumberRule = {
  integer?: boolean;
  label: string;
  max?: number;
  min?: number;
  precision?: number;
};

export const CUSTOMER_EXTEND_NUMBER_RULES = {
  advanceAmount: { label: '预收款金额', precision: 2 },
  baseAmount: { label: '铺底金额', precision: 2 },
  deliveryFee: { label: '送货费用', precision: 2 },
  discountPriceLevel: { integer: true, label: '优惠价格级别' },
  monthlyBusinessScale: { label: '月营业规模', precision: 2 },
  monthlySaleTarget: { label: '月销量目标', precision: 2 },
  pointsRate: { label: '积分系数', precision: 4 },
  priceMarkupRate: { label: '售价上浮率', precision: 4 },
  settleDay: {
    integer: true,
    label: '结账日期',
    max: 31,
    min: 1,
  },
  totalAssets: { label: '总资产', precision: 2 },
} as const satisfies Record<string, CustomerExtendNumberRule>;

export type CustomerExtendNumberField =
  keyof typeof CUSTOMER_EXTEND_NUMBER_RULES;

const DECIMAL_NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function numberFields() {
  return Object.keys(
    CUSTOMER_EXTEND_NUMBER_RULES,
  ) as CustomerExtendNumberField[];
}

export function getCustomerExtendNumberError(
  field: CustomerExtendNumberField,
  value: unknown,
): string | undefined {
  const rule: CustomerExtendNumberRule = CUSTOMER_EXTEND_NUMBER_RULES[field];
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return undefined;
  }

  const text = typeof value === 'number' ? String(value) : String(value).trim();
  if (!DECIMAL_NUMBER_PATTERN.test(text)) {
    return `${rule.label}必须是数字`;
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return `${rule.label}必须是数字`;
  }
  if (rule.integer && !Number.isInteger(parsed)) {
    return `${rule.label}必须是整数`;
  }
  if (rule.min !== undefined && parsed < rule.min) {
    return `${rule.label}不能小于 ${rule.min}`;
  }
  if (rule.max !== undefined && parsed > rule.max) {
    return `${rule.label}不能大于 ${rule.max}`;
  }

  const decimalLength = text.includes('.')
    ? (text.split('.')[1]?.length ?? 0)
    : 0;
  if (rule.precision !== undefined && decimalLength > rule.precision) {
    return `${rule.label}最多输入 ${rule.precision} 位小数`;
  }
  return undefined;
}

export function formatCustomerExtendNumberFields(
  values: Record<string, unknown>,
) {
  const formatted = { ...values };
  for (const field of numberFields()) {
    formatted[field] = formatOptionalNumberInput(values[field]);
  }
  return formatted;
}

export function normalizeCustomerExtendNumberFields(
  values: Record<string, unknown>,
) {
  const normalized = { ...values };
  for (const field of numberFields()) {
    normalized[field] = toOptionalNumberValue(values[field]);
  }
  return normalized;
}
