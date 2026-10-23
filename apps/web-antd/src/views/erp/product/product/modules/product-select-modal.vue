<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpFieldConfigApi } from '#/api/erp/config/field';
import type { ErpProductApi } from '#/api/erp/product/product';

import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { handleTree } from '@vben/utils';

import { message, Modal, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getProductBrandSimpleList } from '#/api/erp/product/brand';
import { getProductCategorySimpleList } from '#/api/erp/product/category';
import { getProductPage } from '#/api/erp/product/product';
import { getWarehouseSimpleList } from '#/api/erp/stock/warehouse';
import {
  applyFieldPermission,
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import {
  buildCustomFieldColumns,
  getProductCustomFieldConfigs,
} from '../utils/custom-fields';

const emit = defineEmits<{
  success: [rows: ErpProductApi.Product[]];
}>();

const props = withDefaults(defineProps<{ showWarehouse?: boolean }>(), {
  showWarehouse: false,
});

const open = ref<boolean>(false);
const selectedRows = ref<ErpProductApi.Product[]>([]);
const { hiddenFields } = useFieldPermission('erp_product');
const customFieldConfigs = ref<ErpFieldConfigApi.FieldConfig[]>([]);
let isEnterListening = false;

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.matches('input, textarea, select, button, [role="button"]') ||
    target.isContentEditable ||
    !!target.closest(
      'input, textarea, select, button, [role="button"], .ant-select, .ant-picker, .ant-input-number, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
    )
  );
}

function normalizeSearchParams(values: Record<string, any>) {
  const params = { ...values };
  if (typeof params.keyword === 'string') {
    const normalized = params.keyword.trim();
    params.keyword = normalized || undefined;
  }
  ['code', 'name', 'factoryCode'].forEach((field) => {
    if (typeof params[field] === 'string') {
      const normalized = params[field].trim().replace(/\s+/g, '%');
      params[field] = normalized || undefined;
    }
  });
  return params;
}

function clearProductSelection() {
  selectedRows.value = [];

  const grid = gridApi.grid as any;
  grid?.clearCheckboxRow?.();
  grid?.clearCheckboxReserve?.();
}

function useSearchSchema(): VbenFormSchema[] {
  return applyFieldPermission(
    [
      {
        fieldName: 'keyword',
        label: '关键词',
        component: 'Input',
        componentProps: {
          placeholder:
            '请输入配件编码、名称、品牌等，多个字段关键词可用 /、+、逗号分隔',
          allowClear: true,
        },
      },
      {
        fieldName: 'code',
        label: '编码',
        component: 'Input',
        componentProps: { placeholder: '请输入配件编码', allowClear: true },
      },
      {
        fieldName: 'name',
        label: '名称',
        component: 'Input',
        componentProps: { placeholder: '请输入配件名称', allowClear: true },
      },
      {
        fieldName: 'vehicleModel',
        label: '适用车型',
        component: 'Input',
        componentProps: { placeholder: '请输入适用车型', allowClear: true },
      },
      {
        fieldName: 'factoryCode',
        label: '厂家编码',
        component: 'Input',
        componentProps: { placeholder: '请输入厂家编码', allowClear: true },
      },
      {
        fieldName: 'brand',
        label: '品牌',
        component: 'ApiSelect',
        componentProps: {
          api: getProductBrandSimpleList,
          labelField: 'name',
          valueField: 'name',
          placeholder: '请选择品牌',
          allowClear: true,
          showSearch: true,
          optionFilterProp: 'label',
        },
      },
      {
        fieldName: 'categoryId',
        label: '配件分类',
        component: 'ApiTreeSelect',
        componentProps: {
          api: async () => {
            const data = await getProductCategorySimpleList();
            return handleTree(data);
          },
          labelField: 'name',
          valueField: 'id',
          childrenField: 'children',
          placeholder: '请选择配件分类',
          treeDefaultExpandAll: true,
          allowClear: true,
          showSearch: true,
          treeNodeFilterProp: 'name',
        },
      },
      ...(props.showWarehouse
        ? [
            {
              fieldName: 'warehouseId',
              label: '仓库',
              component: 'ApiSelect',
              componentProps: {
                api: getWarehouseSimpleList,
                labelField: 'name',
                valueField: 'id',
                placeholder: '请选择仓库',
                allowClear: true,
                showSearch: true,
              },
            },
          ]
        : []),
    ],
    hiddenFields.value,
  );
}

function useColumns(
  hiddenFieldKeys: string[] = [],
  customFields: ErpFieldConfigApi.FieldConfig[] = [],
): VxeTableGridOptions['columns'] {
  const columns: NonNullable<VxeTableGridOptions['columns']> = [
    { type: 'checkbox', width: 50, fixed: 'left' },
    { field: 'code', title: '编码', width: 110, fixed: 'left' },
    { field: 'name', title: '名称', minWidth: 180 },
    { field: 'vehicleModel', title: '车型', minWidth: 140 },
    { field: 'brand', title: '品牌', minWidth: 110 },
    { field: 'factoryCode', title: '厂家编码', minWidth: 120 },
    { field: 'categoryName', title: '配件分类', minWidth: 120 },
    ...(props.showWarehouse
      ? [{ field: 'defaultWarehouseName', title: '仓库', minWidth: 120 }]
      : []),
    { field: 'unitName', title: '单位', width: 80 },
    {
      field: 'currentStock',
      title: '当前库存',
      width: 130,
      slots: { default: 'currentStock' },
    },
    ...(props.showWarehouse
      ? [
          {
            field: 'lockCount',
            title: '占用数量',
            width: 110,
            formatter: 'formatAmount3',
          },
        ]
      : []),
    {
      field: 'referencePrice',
      title: '参考价',
      width: 100,
      formatter: 'formatAmount2',
    },
    {
      field: 'retailPrice',
      title: '零售价',
      width: 100,
      formatter: 'formatAmount2',
    },
    {
      field: 'purchasePrice',
      title: '采购价',
      width: 100,
      formatter: 'formatAmount2',
    },
    { field: 'remark', title: '零件备注', minWidth: 120 },
    {
      field: 'weight',
      title: '重量',
      width: 80,
    },
    {
      field: 'backupPrice1',
      title: '备用价1',
      width: 100,
      formatter: 'formatAmount2',
    },
    {
      field: 'wholesalePrice',
      title: '批发价',
      width: 100,
      formatter: 'formatAmount2',
    },
    {
      field: 'sharePrice',
      title: '股份价',
      width: 100,
      formatter: 'formatAmount2',
    },
  ];
  return [
    ...columns.filter(
      (column: any) =>
        !column.field || !isFieldHidden(hiddenFieldKeys, column.field),
    ),
    ...buildCustomFieldColumns(customFields, hiddenFieldKeys),
  ];
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useSearchSchema(),
  },
  gridOptions: {
    columns: useColumns(hiddenFields.value, customFieldConfigs.value),
    height: '100%',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getProductPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...normalizeSearchParams(formValues),
          });
        },
        querySuccess: async () => {
          await nextTick();
          clearProductSelection();
        },
      },
    },
    rowConfig: {
      keyField: 'id',
      isHover: true,
    },
    checkboxConfig: {
      highlight: true,
      range: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpProductApi.Product>,
  gridEvents: {
    checkboxChange: ({ records }: { records: ErpProductApi.Product[] }) => {
      selectedRows.value = records;
    },
    checkboxAll: ({ records }: { records: ErpProductApi.Product[] }) => {
      selectedRows.value = records;
    },
    cellClick: ({
      row,
      column,
    }: {
      column: any;
      row: ErpProductApi.Product;
    }) => {
      // 点击 checkbox 列时 vxe-table 已自行处理勾选，跳过以避免双重 toggle 导致状态错乱
      if (column?.type === 'checkbox') {
        return;
      }
      const grid = gridApi.grid;
      grid.toggleCheckboxRow(row);
      selectedRows.value = grid.getCheckboxRecords();
    },
  },
});

watch(hiddenFields, (fields) => {
  gridApi.formApi?.setState?.({ schema: useSearchSchema() });
  gridApi.setGridOptions({
    columns: useColumns(fields, customFieldConfigs.value),
  });
});

async function openModal() {
  open.value = true;
  customFieldConfigs.value = await getProductCustomFieldConfigs();
  gridApi.formApi?.setState?.({ schema: useSearchSchema() });
  gridApi.setGridOptions({
    columns: useColumns(hiddenFields.value, customFieldConfigs.value),
  });
  clearProductSelection();
  gridApi.formApi?.resetForm();
  await nextTick();
  await gridApi.query();
  clearProductSelection();
}

async function handleOk() {
  if (selectedRows.value.length === 0) {
    message.warning('请至少勾选一条配件');
    return;
  }
  const formValues = props.showWarehouse
    ? ((await gridApi.formApi?.getValues()) as Record<string, any> | undefined)
    : undefined;
  const selectedWarehouseId = formValues?.warehouseId;
  emit(
    'success',
    props.showWarehouse
      ? selectedRows.value.map((row) => ({
          ...row,
          warehouseId: selectedWarehouseId,
        }))
      : selectedRows.value,
  );
  open.value = false;
}

function handleEnterConfirm(event: KeyboardEvent) {
  if (
    !open.value ||
    selectedRows.value.length === 0 ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.key !== 'Enter' ||
    isEditableTarget(event.target)
  ) {
    return;
  }

  event.preventDefault();
  handleOk();
}

function startEnterListening() {
  if (isEnterListening) {
    return;
  }

  window.addEventListener('keydown', handleEnterConfirm);
  isEnterListening = true;
}

function stopEnterListening() {
  if (!isEnterListening) {
    return;
  }

  window.removeEventListener('keydown', handleEnterConfirm);
  isEnterListening = false;
}

watch(open, (visible) => {
  if (visible) {
    startEnterListening();
  } else {
    stopEnterListening();
  }
});

onBeforeUnmount(stopEnterListening);

defineExpose({ open: openModal });
</script>

<template>
  <Modal
    v-model:open="open"
    class="!w-[85vw]"
    title="选择配件"
    :ok-text="`确定（已选 ${selectedRows.length} 条）`"
    @ok="handleOk"
  >
    <Grid class="h-[70vh]" table-title="配件列表">
      <template #currentStock="{ row }">
        <span>{{ row.currentStock ?? 0 }}</span>
        <Tag
          v-if="Number(row.currentStock ?? 0) === 0"
          color="error"
          class="ml-1"
        >
          库存为零
        </Tag>
        <Tag v-else-if="row.lowStockWarning" color="warning" class="ml-1">
          低库存
        </Tag>
      </template>
      <template #lockCount="{ row }">
        <span>{{ row.lockCount ?? 0 }}</span>
      </template>
    </Grid>
  </Modal>
</template>
