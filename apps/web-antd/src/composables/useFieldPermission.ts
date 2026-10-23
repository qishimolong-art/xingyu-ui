import type { VbenFormSchema } from '#/adapter/form';

import { ref, unref, watch } from 'vue';
import type { MaybeRef } from 'vue';

import { getCurrentUserHiddenFields } from '#/api/system/permission/field';

// Deduplicate permission requests from list/form components mounted together and
// from modals reopened in quick succession. Permission mutation paths can call
// clearFieldPermissionCache to make the next load fetch fresh data immediately.
const TTL_MS = 30_000;
const cache = new Map<string, { p: Promise<string[]>; t: number }>();

export function clearFieldPermissionCache(module?: string) {
  if (module) {
    [...cache.keys()]
      .filter((key) => key === module || key.startsWith(`${module}::`))
      .forEach((key) => cache.delete(key));
  } else {
    cache.clear();
  }
}

type BusinessDeptId = MaybeRef<number | string | null | undefined>;
type IncludeProductPricePermission = MaybeRef<boolean | undefined>;
type CustomerPriceLevel = MaybeRef<number | string | null | undefined>;

const FIELD_ALIAS_MAP: Record<string, string> = {
  backup_price1: 'backupPrice1',
  branch_price: 'referencePrice',
  gross_profit_rate: 'grossProfitRate',
  last_purchase_price: 'lastPurchasePrice',
  min_price: 'minPrice',
  purchase_price: 'purchasePrice',
  reference_price: 'referencePrice',
  retail_price: 'retailPrice',
  sale_price: 'salePrice',
  share_price: 'sharePrice',
  wholesale_price: 'wholesalePrice',
};

function normalizeBusinessDeptId(businessDeptId?: number | string | null) {
  if (businessDeptId == null || businessDeptId === '') {
    return undefined;
  }
  return businessDeptId;
}

function getCacheKey(
  module: string,
  businessDeptId?: number | string | null,
  includeProductPricePermission = true,
  customerPriceLevel?: number | string | null,
) {
  const normalizedDeptId = normalizeBusinessDeptId(businessDeptId);
  const parts = [module];
  if (normalizedDeptId != null) {
    parts.push(`businessDeptId=${normalizedDeptId}`);
  }
  if (!includeProductPricePermission) {
    parts.push('productPricePermission=false');
  }
  if (customerPriceLevel != null && customerPriceLevel !== '') {
    parts.push(`customerPriceLevel=${customerPriceLevel}`);
  }
  return parts.join('::');
}

async function loadCurrentUserHiddenFields(
  module: string,
  businessDeptId?: number | string | null,
  includeProductPricePermission = true,
  customerPriceLevel?: number | string | null,
) {
  const now = Date.now();
  const cacheKey = getCacheKey(
    module,
    businessDeptId,
    includeProductPricePermission,
    customerPriceLevel,
  );
  const hit = cache.get(cacheKey);
  if (hit && TTL_MS > 0 && now - hit.t < TTL_MS) {
    return hit.p;
  }
  const p = getCurrentUserHiddenFields(
    module,
    normalizeBusinessDeptId(businessDeptId),
    includeProductPricePermission,
    customerPriceLevel,
  ).catch((err) => {
    const current = cache.get(cacheKey);
    if (current && current.p === p) {
      cache.delete(cacheKey);
    }
    throw err;
  });
  cache.set(cacheKey, { p, t: now });
  return p;
}

export function isFieldHidden(
  hiddenFields: Set<string> | string[],
  fieldKey?: string,
) {
  if (!fieldKey) {
    return false;
  }
  const fields =
    hiddenFields instanceof Set ? hiddenFields : new Set(hiddenFields);
  return getFieldKeyCandidates(fieldKey).some((key) => fields.has(key));
}

function getFieldKeyCandidates(fieldKey: string) {
  const keys = new Set<string>();
  const add = (key?: string) => {
    if (!key) return;
    keys.add(key);
    keys.add(`col_${key}`);
  };
  const rawKey = fieldKey.startsWith('col_') ? fieldKey.slice(4) : fieldKey;
  add(rawKey);
  add(FIELD_ALIAS_MAP[rawKey]);
  const snakeKey = toSnakeCase(rawKey);
  add(snakeKey);
  add(FIELD_ALIAS_MAP[snakeKey]);
  Object.entries(FIELD_ALIAS_MAP).forEach(([alias, canonical]) => {
    if (canonical === rawKey) {
      add(alias);
    }
  });
  return [...keys];
}

function toSnakeCase(key: string) {
  return key.replaceAll(/([A-Z])/g, '_$1').toLowerCase();
}

export function applyFieldPermission(
  schema: VbenFormSchema[],
  hiddenFields: Set<string> | string[],
) {
  return schema.filter((item) => !isFieldHidden(hiddenFields, item.fieldName));
}

export function useFieldPermission(
  module: string,
  options: {
    businessDeptId?: BusinessDeptId;
    includeProductPricePermission?: IncludeProductPricePermission;
    customerPriceLevel?: CustomerPriceLevel;
  } = {},
) {
  const hiddenFields = ref<string[]>([]);
  const loaded = ref(false);

  async function loadHiddenFields(
    businessDeptId = unref(options.businessDeptId),
    includeProductPricePermission = unref(
      options.includeProductPricePermission,
    ) ?? true,
    customerPriceLevel = unref(options.customerPriceLevel),
  ) {
    try {
      hiddenFields.value = await loadCurrentUserHiddenFields(
        module,
        businessDeptId,
        includeProductPricePermission,
        customerPriceLevel,
      );
    } catch {
      hiddenFields.value = [];
    } finally {
      loaded.value = true;
    }
  }

  function isHidden(fieldKey: string) {
    return isFieldHidden(hiddenFields.value, fieldKey);
  }

  watch(
    () =>
      [
        unref(options.businessDeptId),
        unref(options.includeProductPricePermission) ?? true,
        unref(options.customerPriceLevel),
      ] as const,
    ([businessDeptId, includeProductPricePermission, customerPriceLevel]) => {
      void loadHiddenFields(
        businessDeptId,
        includeProductPricePermission,
        customerPriceLevel,
      );
    },
    { immediate: true },
  );

  return {
    hiddenFields,
    isHidden,
    loadHiddenFields,
    loaded,
  };
}
