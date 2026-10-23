<script lang="ts" setup>
import type { CSSProperties } from 'vue';

import type { PriceReferenceField } from '#/views/erp/utils/price-reference';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { erpPriceInputFormatter } from '@vben/utils';

import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { stockNatural, stockMoney } from '#/views/erp/stock/utils/stock-decimal';
import {
  PRICE_REFERENCE_FIELDS,
  PRICE_REFERENCE_MASK,
  PRODUCT_PRICE_PERMISSION_MODULE,
} from '#/views/erp/utils/price-reference';

const props = withDefaults(
  defineProps<{
    hiddenFields?: string[];
    open?: boolean;
    preserveDecimalPrecision?: boolean;
    rows?: Record<string, any>[];
    tableHeaderHeight?: number;
    tableRowHeight?: number;
    tableWrapper?: HTMLElement | null;
    visibleRows?: number;
  }>(),
  {
    hiddenFields: () => [],
    open: false,
    rows: () => [],
    tableHeaderHeight: 40,
    tableRowHeight: 36,
    tableWrapper: null,
    visibleRows: 10,
  },
);

const {
  hiddenFields: productPriceHiddenFields,
  loaded: productPriceHiddenFieldsLoaded,
} = useFieldPermission(PRODUCT_PRICE_PERMISSION_MODULE);

const bodyTop = ref(props.tableHeaderHeight);
const bodyHeight = ref(props.tableRowHeight * props.visibleRows);
const scrollTop = ref(0);
let bodyWrapper: HTMLElement | null = null;
let resizeObserver: ResizeObserver | undefined;

const visibleProductRows = computed(() =>
  props.rows.filter((row) => Boolean(row?.productId)),
);
const overlayStyle = computed(
  () =>
    ({
      '--erp-price-reference-row-height': `${props.tableRowHeight}px`,
      height: `${props.tableHeaderHeight + bodyHeight.value}px`,
      top: `${Math.max(0, bodyTop.value - props.tableHeaderHeight)}px`,
    }) as CSSProperties,
);
const rowsStyle = computed<CSSProperties>(() => ({
  transform: `translate3d(0, -${scrollTop.value}px, 0)`,
}));

function getBodyWrapper() {
  const wrapper = props.tableWrapper;
  if (!wrapper) {
    return null;
  }
  return (
    wrapper.querySelector<HTMLElement>(
      '.vxe-table--main-wrapper .vxe-table--body-wrapper',
    ) ||
    wrapper.querySelector<HTMLElement>(
      '.vxe-table--body-wrapper:not(.fixed-left--wrapper):not(.fixed-right--wrapper)',
    ) ||
    wrapper.querySelector<HTMLElement>('.vxe-table--body-wrapper')
  );
}

function syncMetrics() {
  const wrapper = props.tableWrapper;
  const currentBodyWrapper = getBodyWrapper();
  if (!wrapper || !currentBodyWrapper) {
    return;
  }
  const wrapperRect = wrapper.getBoundingClientRect();
  const bodyRect = currentBodyWrapper.getBoundingClientRect();
  bodyTop.value = Math.max(0, bodyRect.top - wrapperRect.top);
  bodyHeight.value =
    currentBodyWrapper.clientHeight || props.tableRowHeight * props.visibleRows;
  scrollTop.value = currentBodyWrapper.scrollTop || 0;
}

function handleBodyScroll() {
  scrollTop.value = bodyWrapper?.scrollTop || 0;
}

function detachBodyScroll() {
  bodyWrapper?.removeEventListener('scroll', handleBodyScroll);
  bodyWrapper = null;
  resizeObserver?.disconnect();
  resizeObserver = undefined;
}

function bindBodyScroll() {
  const currentBodyWrapper = getBodyWrapper();
  if (!currentBodyWrapper) {
    return;
  }
  if (bodyWrapper === currentBodyWrapper) {
    syncMetrics();
    return;
  }
  detachBodyScroll();
  bodyWrapper = currentBodyWrapper;
  bodyWrapper.addEventListener('scroll', handleBodyScroll, { passive: true });
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      syncMetrics();
    });
    resizeObserver.observe(bodyWrapper);
    if (props.tableWrapper) {
      resizeObserver.observe(props.tableWrapper);
    }
  }
  syncMetrics();
}

function scheduleSync() {
  void nextTick(() => {
    if (props.open) {
      bindBodyScroll();
    }
  });
}

function isProductPriceFieldHidden(permissionFields: string[]) {
  if (!productPriceHiddenFieldsLoaded.value) {
    return true;
  }
  return permissionFields.some((field) =>
    isFieldHidden(productPriceHiddenFields.value, field),
  );
}

function isReferenceFieldHidden(
  row: Record<string, any>,
  field: PriceReferenceField,
) {
  return (
    Boolean(row?.priceVisible === false) ||
    isFieldHidden(props.hiddenFields, `item_${field.field}`) ||
    isProductPriceFieldHidden(field.permissionFields)
  );
}

function hasReferenceValue(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}

function formatReferenceValue(
  row: Record<string, any>,
  field: PriceReferenceField,
) {
  if (isReferenceFieldHidden(row, field)) {
    return PRICE_REFERENCE_MASK;
  }
  const value = row[field.field];
  if (!hasReferenceValue(value)) {
    return '-';
  }
  if (field.type === 'percent') {
    if (props.preserveDecimalPrecision)
      return `${stockNatural(value as number | string)}%`;
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
      return '-';
    }
    return `${numberValue.toLocaleString('zh-CN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    })}%`;
  }
  return props.preserveDecimalPrecision
    ? stockMoney(value as number | string | undefined)
    : erpPriceInputFormatter(value as number | string | undefined) || '-';
}

function getRowKey(row: Record<string, any>, index: number) {
  if (row.seq !== undefined && row.seq !== null) {
    return `seq_${row.seq}`;
  }
  if (row.id !== undefined && row.id !== null) {
    return `id_${row.id}`;
  }
  return `price_reference_${index}`;
}

watch(
  () => ({
    open: props.open,
    rows: props.rows,
    tableWrapper: props.tableWrapper,
  }),
  ({ open }) => {
    if (open) {
      scheduleSync();
      return;
    }
    detachBodyScroll();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  detachBodyScroll();
});
</script>

<template>
  <div v-if="open" class="erp-price-reference-overlay" :style="overlayStyle">
    <section class="erp-price-reference">
      <table
        aria-label="当前页配件价格"
        class="erp-price-reference__table erp-price-reference__head-table"
      >
        <colgroup>
          <col
            v-for="field in PRICE_REFERENCE_FIELDS"
            :key="String(field.field)"
            :style="field.width ? { width: `${field.width}px` } : undefined"
          />
        </colgroup>
        <thead>
          <tr>
            <th
              v-for="field in PRICE_REFERENCE_FIELDS"
              :key="String(field.field)"
              scope="col"
              :title="field.label"
            >
              {{ field.shortLabel }}
            </th>
          </tr>
        </thead>
      </table>
      <div
        v-if="visibleProductRows.length > 0"
        class="erp-price-reference__viewport"
      >
        <table
          class="erp-price-reference__table erp-price-reference__body-table"
          :style="rowsStyle"
        >
          <colgroup>
            <col
              v-for="field in PRICE_REFERENCE_FIELDS"
              :key="String(field.field)"
              :style="field.width ? { width: `${field.width}px` } : undefined"
            />
          </colgroup>
          <tbody>
            <tr
              v-for="(row, index) in rows"
              :key="getRowKey(row, index)"
              class="erp-price-reference__row"
              :class="{ 'erp-price-reference__row--empty': !row.productId }"
            >
              <td
                v-for="field in PRICE_REFERENCE_FIELDS"
                :key="String(field.field)"
                class="erp-price-reference__value"
                :class="{
                  'erp-price-reference__mask':
                    row.productId &&
                    formatReferenceValue(row, field) === PRICE_REFERENCE_MASK,
                }"
              >
                <template v-if="row.productId">
                  {{ formatReferenceValue(row, field) }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="erp-price-reference__empty">
        当前页暂无可显示价格的配件
      </div>
    </section>
  </div>
</template>

<style scoped>
.erp-price-reference-overlay {
  position: absolute;
  right: 24px;
  z-index: 8;
  display: flex;
  justify-content: flex-end;
  width: min(1000px, calc(100% - 360px));
  min-width: 620px;
  pointer-events: none;
}

.erp-price-reference {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
  background: rgba(248, 250, 252, 0.88);
  border-left: 1px solid rgba(37, 99, 235, 0.18);
  box-shadow: -8px 0 22px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(2px);
}

.erp-price-reference__table {
  width: 100%;
  min-width: 0;
  table-layout: fixed;
  border-spacing: 0;
  border-collapse: collapse;
}

.erp-price-reference__head-table {
  height: 40px;
  border-top: 1px solid #e5eaf2;
  border-bottom: 1px solid #dbeafe;
}

.erp-price-reference__head-table th {
  height: 40px;
  padding: 0 8px;
  overflow: hidden;
  font-size: 11px;
  font-weight: 700;
  color: #2563eb;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-right: 1px solid #e6edf7;
}

.erp-price-reference__viewport {
  position: relative;
  flex: 1;
  overflow: hidden;
}

.erp-price-reference__body-table {
  will-change: transform;
}

.erp-price-reference__row {
  height: var(--erp-price-reference-row-height);
  background: rgba(255, 255, 255, 0.9);
}

.erp-price-reference__value {
  height: var(--erp-price-reference-row-height);
  min-width: 0;
  padding: 0 8px;
  overflow: hidden;
  font-size: 11px;
  font-weight: 600;
  line-height: var(--erp-price-reference-row-height);
  color: #111827;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-right: 1px solid #edf2f7;
  border-bottom: 1px solid #edf2f7;
}

.erp-price-reference__mask {
  letter-spacing: 0;
  color: #475569 !important;
}

.erp-price-reference__row--empty {
  background: rgba(248, 250, 252, 0.64);
}

.erp-price-reference__empty {
  padding: 16px 8px;
  font-size: 12px;
  color: #64748b;
  text-align: center;
  background: rgba(255, 255, 255, 0.88);
}

@media (max-width: 960px) {
  .erp-price-reference-overlay {
    right: 12px;
    width: min(720px, calc(100% - 220px));
    min-width: 0;
  }
}
</style>
