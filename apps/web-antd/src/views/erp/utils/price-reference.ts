import { isEditableEnterTarget } from '#/views/erp/utils/keyboard';
import { onBeforeUnmount, onMounted, ref } from 'vue';

export type PriceReferenceField = {
  field: string;
  label: string;
  permissionFields: string[];
  shortLabel: string;
  type?: 'percent' | 'price';
  width?: number;
};

export const PRODUCT_PRICE_PERMISSION_MODULE = 'erp_product';
export const PRICE_REFERENCE_MASK = '****';

export const PRICE_REFERENCE_FIELDS: PriceReferenceField[] = [
  {
    field: 'productPurchasePrice',
    label: '采购价',
    permissionFields: ['purchasePrice'],
    shortLabel: '采购',
  },
  {
    field: 'salePrice',
    label: '销售价',
    permissionFields: ['salePrice'],
    shortLabel: '销售',
  },
  {
    field: 'lastSalePrice',
    label: '最近销售价',
    permissionFields: ['lastSalePrice', 'salePrice'],
    shortLabel: '近销',
  },
  {
    field: 'minPrice',
    label: '最低价',
    permissionFields: ['minPrice'],
    shortLabel: '最低',
  },
  {
    field: 'referencePrice',
    label: '参考价',
    permissionFields: ['referencePrice'],
    shortLabel: '参考',
  },
  {
    field: 'retailPrice',
    label: '零售价',
    permissionFields: ['retailPrice'],
    shortLabel: '零售',
  },
  {
    field: 'lastPurchasePrice',
    label: '最后采购入库价',
    permissionFields: ['lastPurchasePrice'],
    shortLabel: '最后采购价',
    width: 86,
  },
  {
    field: 'grossProfitRate',
    label: '毛利率',
    permissionFields: ['grossProfitRate'],
    shortLabel: '毛利',
    type: 'percent',
  },
  {
    field: 'backupPrice1',
    label: '备用价1',
    permissionFields: ['backupPrice1'],
    shortLabel: '备1',
  },
  {
    field: 'wholesalePrice',
    label: '批发价',
    permissionFields: ['wholesalePrice'],
    shortLabel: '批发',
  },
  {
    field: 'sharePrice',
    label: '股份价',
    permissionFields: ['sharePrice'],
    shortLabel: '股份',
  },
];

export const PRICE_REFERENCE_FIELD_NAMES = [
  'productPurchasePrice',
  'salePrice',
  'lastSalePrice',
  'minPrice',
  'referencePrice',
  'retailPrice',
  'lastPurchasePrice',
  'grossProfitRate',
  'backupPrice1',
  'wholesalePrice',
  'sharePrice',
  'priceVisible',
] as const;

export function copyPriceReferenceFields(
  target: Record<string, any>,
  source: Record<string, any>,
) {
  for (const field of PRICE_REFERENCE_FIELD_NAMES) {
    if (source[field] !== undefined) {
      target[field] = source[field];
    }
  }
  target.productPurchasePrice ??=
    source.productPurchasePrice ?? source.purchasePrice;
}

export function isPriceReferenceShortcut(event: KeyboardEvent) {
  return event.key.toLowerCase() === 'w' && !event.shiftKey;
}

export function isShortcutOverlayTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return !!element.closest?.(
    '.ant-select-dropdown, .ant-picker-dropdown, .ant-popover',
  );
}

export function shouldIgnorePriceReferenceShortcut(event: KeyboardEvent) {
  return (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    isEditableEnterTarget(event.target) ||
    isShortcutOverlayTarget(event.target)
  );
}

export function useItemPriceReferenceShortcut(
  options: {
    autoStart?: boolean;
    isBlocked?: () => boolean;
  } = {},
) {
  const priceReferenceOpen = ref(false);
  const itemTableWrapRef = ref<HTMLElement | null>(null);
  let isShortcutListening = false;

  function handlePriceReferenceShortcut(event: KeyboardEvent) {
    if (
      !isPriceReferenceShortcut(event) ||
      shouldIgnorePriceReferenceShortcut(event) ||
      options.isBlocked?.()
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    priceReferenceOpen.value = !priceReferenceOpen.value;
  }

  function startPriceReferenceShortcutListening() {
    if (isShortcutListening) {
      return;
    }
    window.addEventListener('keydown', handlePriceReferenceShortcut, true);
    isShortcutListening = true;
  }

  function stopPriceReferenceShortcutListening() {
    if (!isShortcutListening) {
      return;
    }
    window.removeEventListener('keydown', handlePriceReferenceShortcut, true);
    isShortcutListening = false;
    priceReferenceOpen.value = false;
  }

  if (options.autoStart !== false) {
    onMounted(startPriceReferenceShortcutListening);
    onBeforeUnmount(stopPriceReferenceShortcutListening);
  }

  return {
    handlePriceReferenceShortcut,
    itemTableWrapRef,
    priceReferenceOpen,
    startPriceReferenceShortcutListening,
    stopPriceReferenceShortcutListening,
  };
}
