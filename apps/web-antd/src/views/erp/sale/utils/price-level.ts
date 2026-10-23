import type { ErpBaseDataApi } from '#/api/erp/base';
import type { ErpFieldConfigApi } from '#/api/erp/config/field';

import { getRuntimeFieldConfigList } from '#/api/erp/config/field';

export const CUSTOMER_PRICE_LEVEL_VALUE_MAP = {
  spare_price: 1,
  reference_price: 2,
  retail_price: 3,
  wholesale_price: 4,
  last_purchase_in_price: 5,
  stock_cost_price: 6,
  purchase_price: 7,
  sale_price: 8,
  min_price: 9,
  share_price: 10,
  order_price: 11,
} as const;

export type CustomerPriceLevelCode =
  keyof typeof CUSTOMER_PRICE_LEVEL_VALUE_MAP;
export type CustomerPriceLevelValue =
  (typeof CUSTOMER_PRICE_LEVEL_VALUE_MAP)[CustomerPriceLevelCode];

const PRICE_LEVEL_FIELD_KEYS: Record<CustomerPriceLevelCode, string[]> = {
  spare_price: ['backupPrice1', 'backup_price1'],
  reference_price: ['referencePrice', 'reference_price', 'branch_price'],
  retail_price: ['retailPrice', 'retail_price'],
  wholesale_price: ['wholesalePrice', 'wholesale_price'],
  last_purchase_in_price: [
    'lastPurchasePrice',
    'last_purchase_price',
    'last_purchase_in_price',
  ],
  stock_cost_price: ['costPrice', 'stock_cost_price'],
  purchase_price: ['purchasePrice', 'purchase_price'],
  sale_price: ['salePrice', 'sale_price'],
  min_price: ['minPrice', 'min_price'],
  share_price: ['sharePrice', 'share_price'],
  order_price: ['orderPrice', 'order_price'],
};

const LEGACY_PRICE_LEVEL_NAMES: Partial<Record<number, string>> = {
  [CUSTOMER_PRICE_LEVEL_VALUE_MAP.stock_cost_price]: '库存成本价（历史）',
};
const PRODUCT_FIELD_CONFIG_MODULE = 'erp_product';
const ORDER_PRICE_FIELD_LABEL = '订货价';

let orderPriceCustomFieldNames: string[] = [];
let orderPriceCustomFieldPromise: Promise<string[]> | undefined;

export function mapPriceLevelCode(code?: string) {
  return CUSTOMER_PRICE_LEVEL_VALUE_MAP[
    String(code || '') as CustomerPriceLevelCode
  ];
}

export function isSelectablePriceLevelCode(code?: string) {
  return Boolean(
    code &&
    code !== 'stock_cost_price' &&
    mapPriceLevelCode(code) !== undefined,
  );
}

export function mapSelectablePriceLevelOptions(
  list: ErpBaseDataApi.BaseData[] = [],
) {
  return list
    .filter((item) => isSelectablePriceLevelCode(item.code))
    .map((item) => ({
      label: item.name,
      value: mapPriceLevelCode(item.code),
    }))
    .filter(
      (item): item is { label: string; value: number } =>
        item.value !== undefined,
    );
}

function isHiddenField(hiddenFields: Set<string>, fieldKey: string) {
  const rawKey = fieldKey.startsWith('col_') ? fieldKey.slice(4) : fieldKey;
  return hiddenFields.has(rawKey) || hiddenFields.has(`col_${rawKey}`);
}

export function mapVisibleSelectablePriceLevelOptions(
  list: ErpBaseDataApi.BaseData[] = [],
  hiddenFields: string[] = [],
  orderPriceFieldNames: string[] = [],
) {
  const hiddenFieldSet = new Set(hiddenFields);
  return list
    .filter((item) => {
      if (!isSelectablePriceLevelCode(item.code)) {
        return false;
      }
      const code = item.code as CustomerPriceLevelCode;
      const fieldKeys =
        code === 'order_price' && orderPriceFieldNames.length > 0
          ? orderPriceFieldNames
          : PRICE_LEVEL_FIELD_KEYS[code];
      return !fieldKeys.some((fieldKey) =>
        isHiddenField(hiddenFieldSet, fieldKey),
      );
    })
    .map((item) => ({
      label: item.name,
      value: mapPriceLevelCode(item.code),
    }))
    .filter(
      (item): item is { label: string; value: number } =>
        item.value !== undefined,
    );
}

export function buildPriceLevelNameMap(list: ErpBaseDataApi.BaseData[] = []) {
  const entries = list
    .map((item) => [mapPriceLevelCode(item.code), item.name] as const)
    .filter(([value]) => value !== undefined);
  return Object.fromEntries([
    ...entries,
    ...Object.entries(LEGACY_PRICE_LEVEL_NAMES).map(([value, name]) => [
      Number(value),
      name,
    ]),
  ]) as Record<number, string>;
}

export function fillPriceLevelNameMap(
  list: ErpBaseDataApi.BaseData[] = [],
  target: Map<number, string>,
) {
  Object.entries(buildPriceLevelNameMap(list)).forEach(([value, name]) => {
    target.set(Number(value), name);
  });
}

function isOrderPriceCustomField(config: ErpFieldConfigApi.FieldConfig) {
  return (
    String(config.fieldSource || '').toUpperCase() === 'CUSTOM' &&
    (config.fieldGroup || 'base_info') === 'price_info' &&
    String(config.fieldLabel || '').trim() === ORDER_PRICE_FIELD_LABEL &&
    Boolean(config.fieldName)
  );
}

export async function loadOrderPriceCustomFieldNames() {
  if (!orderPriceCustomFieldPromise) {
    orderPriceCustomFieldPromise = getRuntimeFieldConfigList(
      PRODUCT_FIELD_CONFIG_MODULE,
    ).then((configs) => {
      orderPriceCustomFieldNames = configs
        .filter(isOrderPriceCustomField)
        .map((config) => String(config.fieldName));
      return orderPriceCustomFieldNames;
    });
  }
  return orderPriceCustomFieldPromise;
}

export function setOrderPriceCustomFieldNames(fieldNames: string[] = []) {
  orderPriceCustomFieldNames = fieldNames;
  orderPriceCustomFieldPromise = Promise.resolve(orderPriceCustomFieldNames);
}

export function firstNumericPrice(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return Number(value) || 0;
    }
  }
  return 0;
}

function pickOrderPrice(row: Record<string, any>) {
  if (orderPriceCustomFieldNames.length === 0) {
    return undefined;
  }
  for (const fieldName of orderPriceCustomFieldNames) {
    const value = row.customFields?.[fieldName];
    if (value !== undefined && value !== null && value !== '') {
      return firstNumericPrice(value);
    }
  }
  return undefined;
}

export function pickCustomerLevelPrice(
  row: Record<string, any>,
  priceLevel?: number,
) {
  switch (priceLevel) {
    case CUSTOMER_PRICE_LEVEL_VALUE_MAP.spare_price: {
      return firstNumericPrice(row.backupPrice1);
    }
    case CUSTOMER_PRICE_LEVEL_VALUE_MAP.reference_price: {
      return firstNumericPrice(row.referencePrice);
    }
    case CUSTOMER_PRICE_LEVEL_VALUE_MAP.retail_price: {
      return firstNumericPrice(row.retailPrice);
    }
    case CUSTOMER_PRICE_LEVEL_VALUE_MAP.wholesale_price: {
      return firstNumericPrice(row.wholesalePrice);
    }
    case CUSTOMER_PRICE_LEVEL_VALUE_MAP.last_purchase_in_price: {
      return firstNumericPrice(row.lastPurchasePrice, row.productPurchasePrice);
    }
    case CUSTOMER_PRICE_LEVEL_VALUE_MAP.stock_cost_price: {
      return firstNumericPrice(
        row.costPrice,
        row.productPurchasePrice,
        row.purchasePrice,
      );
    }
    case CUSTOMER_PRICE_LEVEL_VALUE_MAP.purchase_price: {
      return firstNumericPrice(row.productPurchasePrice, row.purchasePrice);
    }
    case CUSTOMER_PRICE_LEVEL_VALUE_MAP.sale_price: {
      return firstNumericPrice(row.salePrice);
    }
    case CUSTOMER_PRICE_LEVEL_VALUE_MAP.min_price: {
      return firstNumericPrice(row.minPrice);
    }
    case CUSTOMER_PRICE_LEVEL_VALUE_MAP.share_price: {
      return firstNumericPrice(row.sharePrice);
    }
    case CUSTOMER_PRICE_LEVEL_VALUE_MAP.order_price: {
      return pickOrderPrice(row);
    }
    default: {
      return undefined;
    }
  }
}
