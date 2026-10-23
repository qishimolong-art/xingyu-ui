import type { ErpPurchaseOrderApi } from '#/api/erp/purchase/order';

import dayjs from 'dayjs';
import { z } from '#/adapter/form';
import { parsePurchaseDecimal } from '#/views/erp/purchase/utils/decimal';

type PurchaseOrderDateField = keyof ErpPurchaseOrderApi.PurchaseOrder;

const TIMESTAMP_DATE_FIELDS: PurchaseOrderDateField[] = [
  'orderTime',
  'latestOrderDate',
  'saleDateFrom',
  'saleDateTo',
];

const DATE_ONLY_FIELDS: PurchaseOrderDateField[] = [
  'orderDate',
  'arrivalDate',
  'sendDate',
  'latestArrivalDate',
];

export function parseOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function toOptionalNumberValue(value: unknown) {
  const parsed = parseOptionalNumber(value);
  return parsed === undefined ? undefined : parsed;
}

export function formatOptionalNumberInput(value: unknown) {
  const parsed = parseOptionalNumber(value);
  if (parsed === undefined) {
    return value === null || value === undefined
      ? undefined
      : String(value).trim();
  }
  return String(parsed);
}

export type PurchaseInQtyParseResult =
  | { ok: true; value: number }
  | { message: string; ok: false };

export type PurchaseOrderNumericParseResult = PurchaseInQtyParseResult;

export function parsePurchaseOrderCountText(
  value: unknown,
): PurchaseOrderNumericParseResult {
  const parsed = parsePurchaseDecimal(value, '订货数量', { min: 0 });
  if (!parsed.ok) return parsed;
  if (!parsed.value || parsed.value <= 0) {
    return { ok: false, message: '订货数量不得小于等于 0' };
  }
  return { ok: true, value: parsed.value };
}

export function parsePurchaseOrderPriceText(
  value: unknown,
): PurchaseOrderNumericParseResult {
  const parsed = parsePurchaseDecimal(value, '订货价格', { min: 0 });
  if (!parsed.ok) return parsed;
  if (!parsed.value || parsed.value <= 0) {
    return { ok: false, message: '订货价格不得小于等于 0' };
  }
  return { ok: true, value: parsed.value };
}

export function parsePurchaseInQtyText(
  value: unknown,
  options: { max?: number } = {},
): PurchaseInQtyParseResult {
  const result = parsePurchaseDecimal(value, '入库数量', { min: 0 });
  if (!result.ok) return result;
  const parsed = result.value ?? 0;
  if (parsed <= 0) {
    return { ok: false, message: '入库数量必须大于 0' };
  }
  if (options.max !== undefined && parsed > options.max) {
    return {
      ok: false,
      message: `入库数量不能超过可入库数量(${formatOptionalNumberInput(options.max)})`,
    };
  }
  return { ok: true, value: parsed };
}

export function createOptionalNumberRule(
  label: string,
  options: { integer?: boolean; max?: number; min?: number } = {},
) {
  return z
    .union([z.string(), z.number()])
    .optional()
    .refine((value) => {
      return (
        value === null ||
        value === undefined ||
        value === '' ||
        parseOptionalNumber(value) !== undefined
      );
    }, `${label}必须是数字`)
    .refine((value) => {
      const parsed = parseOptionalNumber(value);
      return (
        parsed === undefined ||
        options.min === undefined ||
        parsed >= options.min
      );
    }, `${label}不能小于 ${options.min}`)
    .refine((value) => {
      const parsed = parseOptionalNumber(value);
      return (
        parsed === undefined ||
        options.max === undefined ||
        parsed <= options.max
      );
    }, `${label}不能大于 ${options.max}`)
    .refine((value) => {
      const parsed = parseOptionalNumber(value);
      return (
        parsed === undefined || !options.integer || Number.isInteger(parsed)
      );
    }, `${label}必须是整数`);
}

function parseDateValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return value;
  }
  if (value instanceof Date) {
    return dayjs(value);
  }
  if (typeof value === 'number') {
    return dayjs(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return value;
    }
    if (/^\d+$/.test(trimmed)) {
      return dayjs(Number(trimmed));
    }
    return dayjs(trimmed.replace(' ', 'T'));
  }
  return dayjs(value as any);
}

function parseDisplayDateValue(value: unknown, treatZeroAsEmpty = false) {
  if (
    treatZeroAsEmpty &&
    (value === 0 || value === '0' || value === '0.0' || value === '0.00')
  ) {
    return null;
  }
  return parseDateValue(value);
}

function parseSubmitDateValue(value: unknown, dateOnly = false) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = parseDateValue(value);
  if (!dayjs.isDayjs(parsed) || !parsed.isValid()) {
    return undefined;
  }
  return dateOnly ? parsed.startOf('day').valueOf() : parsed.valueOf();
}

export function normalizePurchaseOrderDateFields<T extends Record<string, any>>(
  order: T,
): T {
  const normalized = { ...order };

  for (const field of TIMESTAMP_DATE_FIELDS) {
    const value = normalized[field];
    const parsed = parseDisplayDateValue(value);
    if (dayjs.isDayjs(parsed) && parsed.isValid()) {
      (normalized as any)[field] = parsed.valueOf();
    }
  }

  for (const field of DATE_ONLY_FIELDS) {
    const value = normalized[field];
    const parsed = parseDisplayDateValue(value, true);
    if (dayjs.isDayjs(parsed) && parsed.isValid()) {
      (normalized as any)[field] = parsed.format('YYYY-MM-DD');
    } else if (parsed === null) {
      (normalized as any)[field] = undefined;
    }
  }

  return normalized;
}

export function normalizePurchaseOrderGiftItem<
  T extends ErpPurchaseOrderApi.PurchaseOrderItem,
>(item: T): T {
  if (!item.gift) {
    return { ...item };
  }
  return {
    ...item,
    productPrice: 0,
    taxPrice: 0,
    totalPrice: 0,
    totalProductPrice: 0,
    totalTaxPrice: 0,
  };
}

export function normalizePurchaseOrderGiftItems(
  items: ErpPurchaseOrderApi.PurchaseOrderItem[] = [],
) {
  return items.map((item) => normalizePurchaseOrderGiftItem(item));
}

export function hasValidPurchaseOrderDraftItems(
  items: ErpPurchaseOrderApi.PurchaseOrderItem[] = [],
) {
  return items.some((item) => {
    const count = parseOptionalNumber(item.count);
    return (
      item.productId !== null &&
      item.productId !== undefined &&
      item.warehouseId !== null &&
      item.warehouseId !== undefined &&
      count !== undefined &&
      count > 0
    );
  });
}

export function normalizePurchaseOrderNumberFields(
  order: ErpPurchaseOrderApi.PurchaseOrder,
) {
  const normalized = { ...order };
  const taxPercent = parseOptionalNumber(normalized.taxPercent);
  const purchaseCycle = parseOptionalNumber(normalized.purchaseCycle);
  const discountPercent = parseOptionalNumber(normalized.discountPercent);
  const discountPrice = parseOptionalNumber(normalized.discountPrice);
  const feeAmount = parseOptionalNumber(normalized.feeAmount);
  const totalPrice = parseOptionalNumber(normalized.totalPrice);
  const depositPrice = parseOptionalNumber(normalized.depositPrice);

  normalized.taxPercent = taxPercent;
  normalized.purchaseCycle =
    purchaseCycle === undefined ? undefined : Math.trunc(purchaseCycle);
  normalized.discountPercent = discountPercent;
  normalized.discountPrice = discountPrice;
  normalized.feeAmount = feeAmount ?? 0;
  normalized.totalPrice = totalPrice;
  normalized.depositPrice = depositPrice;

  return normalized;
}

export function normalizePurchaseOrderFormData(
  order: ErpPurchaseOrderApi.PurchaseOrder,
) {
  const normalized = normalizePurchaseOrderNumberFields(
    normalizePurchaseOrderDateFields(order),
  );
  normalized.items = normalizePurchaseOrderGiftItems(order.items ?? []);
  return normalized;
}

export function buildCopyPurchaseOrderDraft(
  order: ErpPurchaseOrderApi.PurchaseOrder,
) {
  const draft = normalizePurchaseOrderFormData({
    ...order,
    id: undefined,
    no: undefined,
    status: undefined,
    inCount: undefined,
    returnCount: undefined,
    inStatus: undefined,
    returnStatus: undefined,
    productNames: undefined,
    creatorName: undefined,
    createTime: undefined,
    updater: undefined,
    updaterName: undefined,
    updateTime: undefined,
    latestOrderDate: undefined,
    items: (order.items ?? []).map((item, index) => ({
      ...item,
      clientRowKey: undefined,
      id: undefined,
      seq: index + 1,
      orderId: undefined,
      inCount: undefined,
      returnCount: undefined,
    })),
  });

  return draft;
}

export function normalizePurchaseOrderSubmitData(
  order: ErpPurchaseOrderApi.PurchaseOrder,
) {
  const normalized = normalizePurchaseOrderNumberFields({ ...order });

  for (const field of TIMESTAMP_DATE_FIELDS) {
    const parsed = parseSubmitDateValue(normalized[field]);
    if (parsed !== undefined) {
      (normalized as any)[field] = parsed;
    }
  }

  for (const field of DATE_ONLY_FIELDS) {
    const parsed = parseSubmitDateValue(normalized[field], true);
    if (parsed !== undefined) {
      (normalized as any)[field] = parsed;
    } else if (
      normalized[field] === '' ||
      normalized[field] === null ||
      normalized[field] === undefined
    ) {
      (normalized as any)[field] = undefined;
    }
  }

  normalized.items = normalizePurchaseOrderGiftItems(order.items ?? []);
  return normalized;
}
