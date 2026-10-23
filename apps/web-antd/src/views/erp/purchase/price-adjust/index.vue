<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpFieldConfigApi } from '#/api/erp/config/field';
import type { ErpPartsPriceAdjustApi } from '#/api/erp/parts/price-adjust';

import { nextTick, onActivated, onMounted, ref, watch } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';

import { message, Spin } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchUpdatePriceFields,
  getProductPage,
} from '#/api/erp/parts/price-adjust';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import {
  flattenCustomFields,
  getProductCustomFieldConfigs,
} from '#/views/erp/product/product/utils/custom-fields';
import { queueFocusPurchaseKeywordSearchInput } from '#/views/erp/purchase/utils/keyword-search-focus';

import AdjustModal from './AdjustModal.vue';
import {
  getVisibleCustomPriceFields,
  toCustomPriceColumnField,
  useGridColumns,
  useGridFormSchema,
} from './data';

defineOptions({ name: 'ErpPurchasePriceAdjust' });

const { hiddenFields, loaded: hiddenFieldsLoaded } =
  useFieldPermission('erp_product');
const customFieldConfigs = ref<ErpFieldConfigApi.FieldConfig[]>([]);

const PRICE_UPDATE_FIELDS = [
  'backupPrice1',
  'purchasePrice',
  'referencePrice',
  'retailPrice',
  'wholesalePrice',
  'sharePrice',
  'salePrice',
  'stockMax',
  'stockMin',
  'stockStandard',
] as const;

const [AdjustModalComp, adjustModalApi] = useVbenModal({
  connectedComponent: AdjustModal,
  destroyOnClose: true,
});
const partsPriceAdjustGridShellRef = ref<HTMLElement>();
const activationRefreshMaskVisible = ref(false);

function waitForFrame() {
  return new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || !window.requestAnimationFrame) {
      setTimeout(resolve, 0);
      return;
    }
    window.requestAnimationFrame(() => resolve());
  });
}

function normalizePartsPriceAdjustRows(
  rows: ErpPartsPriceAdjustApi.PartsItem[],
) {
  const priceFields = [
    'backupPrice1',
    'purchasePrice',
    'referencePrice',
    'retailPrice',
    'wholesalePrice',
    'sharePrice',
    'salePrice',
    'stockMax',
    'stockMin',
    'stockStandard',
  ] as const;
  return rows.map((item) => {
    priceFields.forEach((field) => {
      if (item[field] !== null && item[field] !== undefined) {
        (item as any)[field] = Number(item[field]);
      }
    });
    const flattened = flattenCustomFields(item);
    getVisibleCustomPriceFields(
      customFieldConfigs.value,
      hiddenFields.value,
    ).forEach((config) => {
      const fieldType = String(config.fieldType ?? '').toUpperCase();
      const field = toCustomPriceColumnField(config.fieldName);
      if (
        (fieldType === 'DECIMAL' || fieldType === 'INTEGER') &&
        flattened[field] !== null &&
        flattened[field] !== undefined
      ) {
        flattened[field] = Number(flattened[field]);
      }
    });
    return flattened;
  });
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(customFieldConfigs.value, hiddenFields.value),
    height: 'auto',
    keepSource: true,
    editConfig: {
      trigger: 'click',
      mode: 'cell',
      showStatus: true,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          await refreshCustomPriceFieldColumns();
          const result = await getProductPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
          result.list = normalizePartsPriceAdjustRows(result.list);
          return result;
        },
      },
    },
    rowConfig: {
      keyField: 'id',
      isHover: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
      custom: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpPartsPriceAdjustApi.PartsItem>,
});

async function refreshCustomPriceFieldColumns() {
  try {
    customFieldConfigs.value = await getProductCustomFieldConfigs();
    await reloadPriceAdjustColumns();
  } catch {
    // 字段配置读取失败时保留现有列，产品分页仍可继续加载。
  }
}

async function reloadPriceAdjustColumns() {
  const columns =
    useGridColumns(customFieldConfigs.value, hiddenFields.value) || [];
  gridApi.setGridOptions({ columns });
  await gridApi.grid?.clearEdit?.();
  await gridApi.grid?.reloadColumn?.(columns as any[]);
}

async function handleSave() {
  if (!hiddenFieldsLoaded.value) {
    message.warning('价格字段权限加载中，请稍后再保存');
    return;
  }
  const grid = gridApi.grid;
  if (!grid) return;
  // 先提交正在编辑的单元格，否则最后一次编辑不会进入 updateRecords
  await grid.clearEdit();
  const editedRows =
    grid.getUpdateRecords() as ErpPartsPriceAdjustApi.PartsItem[];
  if (editedRows.length === 0) {
    message.info('没有修改的数据');
    return;
  }
  const data = editedRows.map((row) => {
    const item: ErpPartsPriceAdjustApi.BatchUpdatePriceFieldsItem = {
      id: row.id!,
    };
    PRICE_UPDATE_FIELDS.forEach((field) => {
      if (!isFieldHidden(hiddenFields.value, field)) {
        item[field] = row[field];
      }
    });
    item.customFields = Object.fromEntries(
      getVisibleCustomPriceFields(customFieldConfigs.value, hiddenFields.value)
        .filter((config) => !config.readonly)
        .map((config) => [
          config.fieldName,
          (row as any)[toCustomPriceColumnField(config.fieldName)],
        ]),
    );
    return item;
  });
  try {
    await batchUpdatePriceFields(data);
    message.success(`已成功保存 ${data.length} 条配件`);
    gridApi.reload();
  } catch {
    // 错误由全局处理
  }
}

function openAdjustModal(initFilter?: Record<string, any>) {
  adjustModalApi.setData({ initFilter: initFilter ?? {} });
  adjustModalApi.open();
}

function handleNameClick(row: ErpPartsPriceAdjustApi.PartsItem) {
  openAdjustModal({ code: row.code, name: row.name });
}

watch(hiddenFields, () => {
  void reloadPriceAdjustColumns();
});

let activatedOnce = false;
let activationRefreshVersion = 0;

async function refreshActivatedPartsPriceAdjustPage() {
  const refreshVersion = ++activationRefreshVersion;

  activationRefreshMaskVisible.value = true;
  try {
    await nextTick();
    await waitForFrame();
    await waitForFrame();

    if (refreshVersion !== activationRefreshVersion) {
      return;
    }

    await refreshCustomPriceFieldColumns();
    const proxyInfo = gridApi.grid?.getProxyInfo?.();
    const pager = proxyInfo?.pager;
    const pageSize = Number(pager?.pageSize || 20);
    const currentPage = Number(pager?.currentPage || 1);
    const formValues = await gridApi.formApi.getValues();
    let result = await getProductPage({
      pageNo: currentPage,
      pageSize,
      ...formValues,
    });
    const total = Number(result.total || 0);
    const pageCount = Math.max(Math.ceil(total / pageSize), 1);
    const finalPage = Math.min(currentPage, pageCount);

    if (finalPage !== currentPage) {
      result = await getProductPage({
        pageNo: finalPage,
        pageSize,
        ...formValues,
      });
    }

    if (refreshVersion !== activationRefreshVersion) {
      return;
    }

    const rows = normalizePartsPriceAdjustRows(result.list ?? []);
    if (pager) {
      pager.currentPage = finalPage;
      pager.pageSize = pageSize;
      pager.total = Number(result.total || 0);
    }
    await gridApi.grid?.loadData?.(rows);
  } catch (error) {
    console.error(
      'Error occurred while refreshing parts price adjust page:',
      error,
    );
  } finally {
    if (refreshVersion === activationRefreshVersion) {
      activationRefreshMaskVisible.value = false;
      queueFocusPurchaseKeywordSearchInput(partsPriceAdjustGridShellRef);
    }
  }
}

onMounted(() => {
  queueFocusPurchaseKeywordSearchInput(partsPriceAdjustGridShellRef);
});

onActivated(() => {
  if (!activatedOnce) {
    activatedOnce = true;
    queueFocusPurchaseKeywordSearchInput(partsPriceAdjustGridShellRef);
    return;
  }
  void refreshActivatedPartsPriceAdjustPage();
});
</script>

<template>
  <Page auto-content-height>
    <AdjustModalComp @success="gridApi.reload()" />

    <div
      ref="partsPriceAdjustGridShellRef"
      class="parts-price-adjust-grid-shell"
    >
      <Grid table-title="配件价格调整">
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '保存',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:product:update'],
                onClick: handleSave,
              },
              {
                label: '批量调价/库存',
                icon: ACTION_ICON.FILTER,
                auth: ['erp:parts:adjust-price'],
                onClick: () => openAdjustModal(),
              },
            ]"
          />
        </template>

        <template #name="{ row }">
          <a
            class="cursor-pointer text-blue-500 hover:underline"
            @click="handleNameClick(row)"
          >
            {{ row.name }}
          </a>
        </template>
      </Grid>
      <div
        v-if="activationRefreshMaskVisible"
        class="parts-price-adjust-activation-mask"
      >
        <div class="parts-price-adjust-activation-mask__content">
          <Spin size="small" />
          <span>同步最新数据中...</span>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.parts-price-adjust-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.parts-price-adjust-activation-mask {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  background: hsl(var(--background) / 58%);
}

.parts-price-adjust-activation-mask__content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--card) / 92%);
  box-shadow: 0 8px 24px rgb(15 23 42 / 12%);
  color: hsl(var(--foreground));
  font-size: 13px;
  line-height: 20px;
}
</style>
