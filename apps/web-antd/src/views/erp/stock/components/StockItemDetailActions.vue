<script setup lang="ts">
import { provide as provideStockDecimalMode } from 'vue';
const props = defineProps<{
  activeRow?: Record<string, any>;
  blocked?: boolean;
  deptId?: number;
  enabled?: boolean;
  hiddenFields?: string[];
  wrapper?: HTMLElement | null;
}>();
const emit = defineEmits<{ productUpdated: [] }>();
provideStockDecimalMode('stock-decimal-context', true);
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';

import { message } from 'ant-design-vue';

import { getProduct } from '#/api/erp/product/product';
import PurchaseItemDetailShortcuts from '#/views/erp/purchase/components/PurchaseItemDetailShortcuts.vue';
import {
  focusPurchaseShortcutOwner,
  isPurchaseShortcutOwnerActive,
} from '#/views/erp/purchase/utils/shortcut-scope';
import {
  hasOpenFormControlPopup,
  isEditableEnterTarget,
} from '#/views/erp/utils/keyboard';
import { copyPriceReferenceFields } from '#/views/erp/utils/price-reference';

const shortcuts = ref<InstanceType<typeof PurchaseItemDetailShortcuts>>();
let disposed = false;
let productOpening = false;
const { hasAccessByCodes } = useAccess();
const permissions: Record<string, string[]> = {
  ' ': ['erp:purchase-in:query', 'erp:purchase-return:query'],
  Shift: ['erp:purchase-order:query'],
  s: ['erp:sale-out:query'],
  q: ['erp:sale-quote:query'],
  f: ['erp:product:update'],
};
const allowed = (key: string) =>
  (permissions[key] ?? []).some((code) => hasAccessByCodes([code]));
function isBlockedForPrice() {
  return (
    props.enabled === false ||
    hasOpenFormControlPopup() ||
    shortcuts.value?.isShortcutDialogOpen() ||
    !isPurchaseShortcutOwnerActive(props.wrapper ?? null)
  );
}
function isBlocked() {
  return (
    props.enabled === false ||
    props.blocked ||
    hasOpenFormControlPopup() ||
    shortcuts.value?.isShortcutDialogOpen() ||
    !isPurchaseShortcutOwnerActive(props.wrapper ?? null)
  );
}
async function keydown(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    isEditableEnterTarget(event.target)
  ) {
    shortcuts.value?.resetPendingShortcutState();
    return;
  }
  if (isBlocked()) {
    shortcuts.value?.resetPendingShortcutState();
    return;
  }
  const key = event.key === 'Shift' ? 'Shift' : event.key.toLowerCase();
  if (
    (permissions[key] && !allowed(key)) ||
    (event.shiftKey && key !== 'Shift')
  ) {
    shortcuts.value?.resetPendingShortcutState();
    return;
  }
  if (key === 'f' && props.activeRow?.productId) {
    event.preventDefault();
    if (productOpening) return;
    productOpening = true;
    const row = props.activeRow;
    try {
      const product = await getProduct(row.productId);
      if (disposed || row !== props.activeRow || isBlocked()) return;
      if (props.deptId && product.deptId && props.deptId !== product.deptId) {
        message.warning('该商品不属于当前单据部门，不能修改');
        return;
      }
      shortcuts.value?.openProductEdit();
    } catch {
      message.warning('商品信息加载失败，请重试');
    } finally {
      productOpening = false;
    }
    return;
  }
  shortcuts.value?.handleShortcut(event);
}
function keyup(event: KeyboardEvent) {
  if (isBlocked()) shortcuts.value?.resetPendingShortcutState();
  else shortcuts.value?.handleShortcutKeyup(event);
}
async function productUpdated(updated: Record<string, any>) {
  const row = props.activeRow;
  if (!row?.productId || row.productId !== updated.productId) return;
  const product = await getProduct(row.productId);
  if (disposed || row !== props.activeRow || props.enabled === false) return;
  for (const field of [
    'productCode',
    'productName',
    'productBarCode',
    'productUnitName',
  ]) {
    if (updated[field] !== undefined) row[field] = updated[field];
  }
  copyPriceReferenceFields(row, product);
  emit('productUpdated');
}
onMounted(() => {
  window.addEventListener('keydown', keydown, true);
  window.addEventListener('keyup', keyup, true);
});
onBeforeUnmount(() => {
  disposed = true;
  window.removeEventListener('keydown', keydown, true);
  window.removeEventListener('keyup', keyup, true);
});
defineExpose({
  isBlockedForPrice,
  isBlocked,
  pointer: (event: MouseEvent) =>
    focusPurchaseShortcutOwner(props.wrapper ?? null, event.target),
});
</script>
<template>
  <span class="stock-detail-history-hints">
    <span
      v-for="entry in [
        [' ', 'Space', '采购历史'],
        ['Shift', 'Shift', '采购订单'],
        ['s', 'S', '销售历史'],
        ['q', 'Q', '报价订单'],
        ['f', 'F', '修改商品'],
      ]"
      :key="entry[0]"
      :aria-disabled="!allowed(entry[0]!)"
      :style="{ opacity: allowed(entry[0]!) ? 1 : 0.4 }"
      >{{ entry[1] }} {{ entry[2] }}
    </span>
  </span>
  <PurchaseItemDetailShortcuts
    ref="shortcuts"
    :active-row="activeRow"
    :dept-id="deptId"
    :hidden-fields="hiddenFields"
    :sale-history-enabled="true"
    :create-enabled="false"
    :is-stock-selector-open="() => enabled === false"
    warning-message="请先点击一条有商品的明细"
    @product-updated="productUpdated"
  />
</template>
