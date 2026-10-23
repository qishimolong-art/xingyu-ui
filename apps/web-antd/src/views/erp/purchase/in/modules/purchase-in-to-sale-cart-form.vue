<script lang="ts" setup>
import '#/views/erp/purchase/utils/candidate-focus';
import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';
import type { Key } from 'ant-design-vue/es/table/interface';

import { onBeforeUnmount, ref, watch } from 'vue';

import { useUserStore } from '@vben/stores';
import { formatDateTime } from '@vben/utils';

import {
  Checkbox,
  Descriptions,
  DescriptionsItem,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Select,
  Table,
  TreeSelect,
  message,
} from 'ant-design-vue';

import {
  createSaleCartFromPurchaseIn,
  getPurchaseIn,
  getPurchaseInSaleCartableItemPage,
} from '#/api/erp/purchase/in';
import { getBaseDataSimpleList } from '#/api/erp/base';
import { getCustomerSalePriceLevel } from '#/api/erp/sale/customer';
import { getSaleWarehouseSimpleListByDept } from '#/api/erp/stock/warehouse';
import { getCurrentUserHiddenFields } from '#/api/system/permission/field';
import { isFormInputTarget } from '#/views/erp/purchase/utils/item-form';
import { formatPurchaseAmount, formatPurchaseDecimal } from '#/views/erp/purchase/utils/decimal';
import {
  collectCustomerDeptIds,
  loadCustomerSaleDeptTree,
  resolvePreferredCustomerDeptId,
} from '#/views/erp/sale/utils/customer-dept';
import SaleCustomerLazySelect from '#/views/erp/sale/components/SaleCustomerLazySelect.vue';
import { getCurrentTimestamp } from '#/views/erp/sale/utils/form-defaults';
import {
  firstNumericPrice,
  loadOrderPriceCustomFieldNames,
  mapVisibleSelectablePriceLevelOptions,
  pickCustomerLevelPrice,
} from '#/views/erp/sale/utils/price-level';

import { formatPurchaseInCountInput } from './purchase-in-count-input';

const emit = defineEmits(['success']);
const userStore = useUserStore();

const DEFAULT_ITEM_PAGE_SIZE = 10;
const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];

type SaleCartRow = ErpPurchaseInApi.SaleCartableItem & {
  count?: number;
  deptId?: number;
  giftFlag?: boolean;
  productPrice?: number;
  remark?: string;
  saleWarehouseId?: number;
};

const visible = ref(false);
const loading = ref(false);
const sourcePurchaseIn = ref<ErpPurchaseInApi.PurchaseIn>();
const rows = ref<SaleCartRow[]>([]);
const rowCache = ref<Map<string, SaleCartRow>>(new Map());
const selectedRowKeys = ref<Key[]>([]);
const customerOptions = ref<any[]>([]);
const priceLevelOptions = ref<{ label: string; value: number }[]>([]);
const saleDeptOptions = ref<any[]>([]);
const warehouseOptions = ref<any[]>([]);
const customerId = ref<number>();
const customerPriceLevel = ref<number>();
const selectedPriceLevel = ref<number>();
const deptId = ref<number>();
const cartTime = ref<string | number>(getCurrentTimestamp());
const saleUserId = ref<number>();
const settleMethod = ref<string>();
const invoiceType = ref<string>();
const deliveryMethod = ref<string>();
const remark = ref('');
const itemPageState = ref({
  orderDirection: undefined as 'asc' | 'desc' | undefined,
  orderField: undefined as string | undefined,
  pageNo: 1,
  pageSize: DEFAULT_ITEM_PAGE_SIZE,
  total: 0,
});

function getRowKey(record: SaleCartRow) {
  return record.sourceInItemId as Key;
}

function normalizeCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

function getEffectivePriceLevel() {
  return selectedPriceLevel.value ?? customerPriceLevel.value;
}

async function loadPriceLevelOptions() {
  const [list, hiddenFields, orderPriceFieldNames] = await Promise.all([
    getBaseDataSimpleList('price_level'),
    getCurrentUserHiddenFields('erp_product', deptId.value),
    loadOrderPriceCustomFieldNames(),
  ]);
  priceLevelOptions.value = mapVisibleSelectablePriceLevelOptions(
    list || [],
    hiddenFields || [],
    orderPriceFieldNames || [],
  );
  if (
    selectedPriceLevel.value !== undefined &&
    !priceLevelOptions.value.some(
      (item) => item.value === selectedPriceLevel.value,
    )
  ) {
    selectedPriceLevel.value = undefined;
    applyPriceLevelToRows();
  }
  return priceLevelOptions.value;
}

function pickProductPrice(
  row: SaleCartRow,
  priceLevel = getEffectivePriceLevel(),
) {
  const customerPrice = pickCustomerLevelPrice(row, priceLevel);
  if (customerPrice !== undefined) {
    return customerPrice;
  }
  return firstNumericPrice(row.salePrice, row.retailPrice, row.referencePrice);
}

function applyPriceLevelToRows() {
  rowCache.value.forEach((row) => {
    row.productPrice = row.giftFlag ? 0 : pickProductPrice(row);
  });
}

function pickCurrentProductPrice(row: SaleCartRow) {
  return pickProductPrice(row);
}

function getSelectedRows() {
  return selectedRowKeys.value
    .map((key) => rowCache.value.get(String(key)))
    .filter((row): row is SaleCartRow => Boolean(row));
}

function handleSelectionChange(keys: Key[]) {
  selectedRowKeys.value = keys;
}

function resolveSaleWarehouseId(
  item: SaleCartRow,
  preferredWarehouseId?: number,
) {
  if (
    preferredWarehouseId &&
    warehouseOptions.value.some(
      (warehouse) => warehouse.id === preferredWarehouseId,
    )
  ) {
    return preferredWarehouseId;
  }
  if (
    item.warehouseId &&
    warehouseOptions.value.some(
      (warehouse) => warehouse.id === item.warehouseId,
    )
  ) {
    return item.warehouseId;
  }
  return warehouseOptions.value[0]?.id;
}

function mergeSaleCartableRow(item: ErpPurchaseInApi.SaleCartableItem) {
  const key = String(item.sourceInItemId);
  const cached = rowCache.value.get(key);
  const row: SaleCartRow = {
    ...item,
    count: cached?.count ?? item.saleCartableCount,
    giftFlag: cached?.giftFlag ?? false,
    deptId: cached?.deptId ?? deptId.value,
    productPrice:
      cached?.productPrice ??
      pickProductPrice({
        ...item,
        giftFlag: false,
      }),
    remark: cached?.remark ?? item.remark,
    saleWarehouseId: resolveSaleWarehouseId(item, cached?.saleWarehouseId),
  };
  rowCache.value.set(key, row);
  return row;
}

async function loadSaleCartableItemPage(
  options: {
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    pageNo?: number;
    pageSize?: number;
  } = {},
) {
  const sourceId = sourcePurchaseIn.value?.id;
  if (!sourceId) {
    rows.value = [];
    itemPageState.value.total = 0;
    return;
  }
  const nextState = {
    ...itemPageState.value,
    ...options,
    pageNo: options.pageNo ?? itemPageState.value.pageNo,
    pageSize: options.pageSize ?? itemPageState.value.pageSize,
  };
  loading.value = true;
  try {
    const result = await getPurchaseInSaleCartableItemPage({
      inId: sourceId,
      orderDirection: nextState.orderDirection,
      orderField: nextState.orderField,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
    });
    itemPageState.value = {
      ...nextState,
      total: Number(result?.total ?? 0),
    };
    const pageRows = result?.list || [];
    rows.value = pageRows.map((item) => mergeSaleCartableRow(item));
    if (itemPageState.value.total === 0) {
      message.warning('当前采购入库单无可转换明细');
    }
  } finally {
    loading.value = false;
  }
}

async function handleItemPageChange(pageNo: number, pageSize: number) {
  await loadSaleCartableItemPage({ pageNo, pageSize });
}

function filterOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const text = [
    option?.label,
    option?.name,
    option?.code,
    option?.no,
    option?.value,
  ]
    .filter(Boolean)
    .join(' ');
  return text.toLowerCase().includes(keyword);
}

async function handleCustomerSelectChange(value: any) {
  await handleCustomerChange(typeof value === 'number' ? value : undefined);
}

function handleCustomerOptionsChange(options: any[]) {
  customerOptions.value = options || [];
}

async function resolveCustomerPriceLevel(value?: number) {
  if (!value) {
    return undefined;
  }
  const cachedCustomer = customerOptions.value.find(
    (item) => item.id === value && !item.disabled,
  );
  if (cachedCustomer?.priceLevel !== undefined) {
    return cachedCustomer.priceLevel;
  }
  try {
    return await getCustomerSalePriceLevel(value);
  } catch {
    message.warning('客户价格级别加载失败，售价将按默认价格显示');
    return undefined;
  }
}

async function handleCustomerChange(value?: number) {
  customerId.value = value;
  selectedPriceLevel.value = undefined;
  customerPriceLevel.value = await resolveCustomerPriceLevel(value);
  applyPriceLevelToRows();
  saleDeptOptions.value = await loadCustomerSaleDeptTree(value);
  const allowedDeptIds = collectCustomerDeptIds(saleDeptOptions.value);
  deptId.value = resolvePreferredCustomerDeptId(allowedDeptIds, {
    currentDeptId: userStore.userInfo?.deptId,
  });
  await handleDeptChange(deptId.value);
}

function handlePriceLevelChange(value: any) {
  selectedPriceLevel.value = typeof value === 'number' ? value : undefined;
  applyPriceLevelToRows();
}

async function handleDeptChange(value?: number) {
  deptId.value = value;
  await loadPriceLevelOptions();
  warehouseOptions.value = value
    ? await getSaleWarehouseSimpleListByDept(value)
    : [];
  rowCache.value.forEach((row) => {
    row.deptId = value;
    const currentAllowed = warehouseOptions.value.some(
      (warehouse) => warehouse.id === row.saleWarehouseId,
    );
    if (!currentAllowed) {
      const sameSourceWarehouse = warehouseOptions.value.find(
        (warehouse) => warehouse.id === row.warehouseId,
      );
      row.saleWarehouseId =
        sameSourceWarehouse?.id ?? warehouseOptions.value[0]?.id;
    }
  });
}

function validateSelectedRows(selectedRows: SaleCartRow[]) {
  if (!customerId.value) {
    message.warning('请选择客户');
    return false;
  }
  if (!deptId.value) {
    message.warning('请选择销售部门');
    return false;
  }
  if (selectedRows.length === 0) {
    message.warning('请至少勾选一条明细');
    return false;
  }
  for (let index = 0; index < selectedRows.length; index++) {
    const row = selectedRows[index]!;
    const count = normalizeCount(row.count);
    const available = normalizeCount(row.saleCartableCount);
    if (!row.saleWarehouseId) {
      message.warning(`第 ${index + 1} 行：请选择销售仓库`);
      return false;
    }
    if (count <= 0) {
      message.warning(`第 ${index + 1} 行：转换数量必须大于 0`);
      return false;
    }
    if (count > available) {
      message.warning(`第 ${index + 1} 行：转换数量不能大于可转换数量`);
      return false;
    }
    if (!row.giftFlag && normalizeCount(row.productPrice) <= 0) {
      message.warning(`第 ${index + 1} 行：销售单价必须大于 0`);
      return false;
    }
  }
  return true;
}

async function handleConfirm() {
  if (!sourcePurchaseIn.value?.id) {
    message.warning('缺少来源采购入库单');
    return;
  }
  const selectedRows = getSelectedRows();
  if (!validateSelectedRows(selectedRows)) {
    return;
  }
  loading.value = true;
  try {
    const result = await createSaleCartFromPurchaseIn({
      sourceInId: sourcePurchaseIn.value.id,
      customerId: customerId.value,
      deptId: deptId.value,
      cartTime: cartTime.value,
      saleUserId: saleUserId.value,
      settleMethod: settleMethod.value,
      invoiceType: invoiceType.value,
      deliveryMethod: deliveryMethod.value,
      remark: remark.value,
      items: selectedRows.map((row) => ({
        sourceInItemId: row.sourceInItemId!,
        deptId: row.deptId ?? deptId.value,
        warehouseId: row.saleWarehouseId,
        count: normalizeCount(row.count),
        productPrice: row.giftFlag ? 0 : normalizeCount(row.productPrice),
        giftFlag: !!row.giftFlag,
        batchNo: row.batchNo,
        remark: row.remark,
      })),
    });
    message.success(
      result?.no ? `销售手推车创建成功：${result.no}` : '销售手推车创建成功',
    );
    visible.value = false;
    emit('success');
  } finally {
    loading.value = false;
  }
}

async function open(params: { sourcePurchaseIn: ErpPurchaseInApi.PurchaseIn }) {
  visible.value = true;
  loading.value = true;
  rows.value = [];
  rowCache.value = new Map();
  selectedRowKeys.value = [];
  customerId.value = undefined;
  customerPriceLevel.value = undefined;
  selectedPriceLevel.value = undefined;
  itemPageState.value = {
    orderDirection: undefined,
    orderField: undefined,
    pageNo: 1,
    pageSize: DEFAULT_ITEM_PAGE_SIZE,
    total: 0,
  };
  saleDeptOptions.value = [];
  warehouseOptions.value = [];
  deptId.value = userStore.userInfo?.deptId;
  saleUserId.value = userStore.userInfo?.id;
  cartTime.value = getCurrentTimestamp();
  settleMethod.value = undefined;
  invoiceType.value = undefined;
  deliveryMethod.value = undefined;
  try {
    const sourceId = params.sourcePurchaseIn.id;
    sourcePurchaseIn.value = sourceId
      ? await getPurchaseIn(sourceId, { includeItems: false })
      : params.sourcePurchaseIn;
    remark.value = sourcePurchaseIn.value?.no
      ? `由采购入库单 ${sourcePurchaseIn.value.no} 转入`
      : '由采购入库单转入';
    await handleDeptChange(deptId.value);
    await loadSaleCartableItemPage({
      pageNo: 1,
      pageSize: DEFAULT_ITEM_PAGE_SIZE,
    });
  } finally {
    loading.value = false;
  }
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (!visible.value || event.key !== 'Enter' || event.defaultPrevented) {
    return;
  }
  if (isFormInputTarget(event.target)) {
    return;
  }
  event.preventDefault();
  void handleConfirm();
}

const columns = [
  { title: '产品名称', dataIndex: 'productName', width: 180 },
  { title: '采购入库单号', dataIndex: 'sourceInNo', width: 150 },
  { title: '产品编号', dataIndex: 'productCode', width: 120 },
  { title: '单位', dataIndex: 'productUnitName', width: 70 },
  { title: '来源仓库', dataIndex: 'warehouseName', width: 140 },
  {
    title: '销售仓库',
    dataIndex: 'saleWarehouseId',
    width: 170,
    key: 'saleWarehouseId',
  },
  { title: '入库数量', dataIndex: 'inCount', width: 100, key: 'inCount' },
  {
    title: '已转换数量',
    dataIndex: 'convertedCount',
    width: 110,
    key: 'convertedCount',
  },
  {
    title: '可转换数量',
    dataIndex: 'saleCartableCount',
    width: 110,
    key: 'saleCartableCount',
  },
  { title: '转换数量', dataIndex: 'count', width: 130, key: 'count' },
  {
    title: '采购单价',
    dataIndex: 'purchasePrice',
    width: 110,
    key: 'purchasePrice',
  },
  {
    title: '销售单价',
    dataIndex: 'productPrice',
    width: 130,
    key: 'productPrice',
  },
  { title: '赠品', dataIndex: 'giftFlag', width: 80, key: 'giftFlag' },
  { title: '批次号', dataIndex: 'batchNo', width: 120 },
  { title: '仓位', dataIndex: 'warehousePosition', width: 110 },
  { title: '备注', dataIndex: 'remark', width: 180, key: 'remark' },
];

watch(visible, (open) => {
  if (open) {
    window.addEventListener('keydown', handleWindowKeydown);
  } else {
    window.removeEventListener('keydown', handleWindowKeydown);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown);
});

defineExpose({ open });
</script>

<template>
  <Modal
    v-model:open="visible"
    class="!w-[85vw]"
    title="采购入库转销售手推车"
    :confirm-loading="loading"
    ok-text="创建"
    @ok="handleConfirm"
  >
    <Descriptions size="small" bordered :column="4" class="mb-3">
      <DescriptionsItem label="采购入库单号">
        {{ sourcePurchaseIn?.no || '-' }}
      </DescriptionsItem>
      <DescriptionsItem label="供应商">
        {{ sourcePurchaseIn?.supplierName || '-' }}
      </DescriptionsItem>
      <DescriptionsItem label="部门">
        {{ sourcePurchaseIn?.deptName || '-' }}
      </DescriptionsItem>
      <DescriptionsItem label="入库时间">
        {{ formatDateTime(sourcePurchaseIn?.inTime) || '-' }}
      </DescriptionsItem>
    </Descriptions>

    <div class="mb-3 grid grid-cols-4 gap-3">
      <div>
        <div class="mb-1 text-sm text-muted-foreground">客户</div>
        <SaleCustomerLazySelect
          v-model:value="customerId"
          :options="customerOptions"
          placeholder="请选择客户"
          allow-clear
          class="w-full"
          @change="handleCustomerSelectChange"
          @options-change="handleCustomerOptionsChange"
        />
      </div>
      <div>
        <div class="mb-1 text-sm text-muted-foreground">销售部门</div>
        <TreeSelect
          popup-class-name="erp-candidate-focus-popup"
          v-model:value="deptId"
          :tree-data="saleDeptOptions"
          :field-names="{ label: 'name', value: 'id', children: 'children' }"
          placeholder="请选择销售部门"
          show-search
          allow-clear
          tree-default-expand-all
          class="w-full"
          @change="handleDeptChange"
        />
      </div>
      <div>
        <div class="mb-1 text-sm text-muted-foreground">价格体系</div>
        <Select
          popup-class-name="erp-candidate-focus-popup"
          v-model:value="selectedPriceLevel"
          :options="priceLevelOptions"
          placeholder="请选择价格体系"
          show-search
          allow-clear
          class="w-full"
          :filter-option="filterOption"
          @change="handlePriceLevelChange"
        />
      </div>
      <div>
        <div class="mb-1 text-sm text-muted-foreground">结算方式</div>
        <Input v-model:value="settleMethod" class="w-full" />
      </div>
      <div>
        <div class="mb-1 text-sm text-muted-foreground">备注</div>
        <Input v-model:value="remark" class="w-full" />
      </div>
    </div>

    <Table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="false"
      :scroll="{ x: 'max-content', y: 'calc(70vh - 230px)' }"
      :row-key="getRowKey"
      :row-selection="{
        preserveSelectedRowKeys: true,
        selectedRowKeys,
        onChange: handleSelectionChange,
      }"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'saleWarehouseId'">
          <Select
            popup-class-name="erp-candidate-focus-popup"
            v-model:value="record.saleWarehouseId"
            :options="warehouseOptions"
            :field-names="{ label: 'name', value: 'id' }"
            placeholder="请选择销售仓库"
            size="small"
            show-search
            allow-clear
            class="w-full"
            :filter-option="filterOption"
          />
        </template>
        <template v-else-if="column.key === 'inCount'">
          {{ formatPurchaseDecimal(record.inCount) }}
        </template>
        <template v-else-if="column.key === 'convertedCount'">
          {{ formatPurchaseDecimal(record.convertedCount) }}
        </template>
        <template v-else-if="column.key === 'saleCartableCount'">
          {{ formatPurchaseDecimal(record.saleCartableCount) }}
        </template>
        <template v-else-if="column.key === 'count'">
          <InputNumber
            v-model:value="record.count"
            :min="0"
            :max="record.saleCartableCount"
            :precision="6"
            :formatter="formatPurchaseInCountInput"
            size="small"
            class="w-full"
          />
        </template>
        <template v-else-if="column.key === 'purchasePrice'">
          {{ formatPurchaseAmount(record.purchasePrice, '-') }}
        </template>
        <template v-else-if="column.key === 'productPrice'">
          <InputNumber
            v-model:value="record.productPrice"
            :min="0"
            :precision="6"
            :disabled="record.giftFlag"
            size="small"
            class="w-full"
          />
        </template>
        <template v-else-if="column.key === 'giftFlag'">
          <Checkbox
            v-model:checked="record.giftFlag"
            @change="
              record.productPrice = record.giftFlag
                ? 0
                : pickCurrentProductPrice(record)
            "
          />
        </template>
        <template v-else-if="column.key === 'remark'">
          <Input v-model:value="record.remark" size="small" class="w-full" />
        </template>
      </template>
    </Table>
    <div class="purchase-in-sale-cart-item-pager mt-2 flex justify-end">
      <Pagination
        :current="itemPageState.pageNo"
        :page-size="itemPageState.pageSize"
        :page-size-options="ITEM_PAGE_SIZE_OPTIONS"
        :show-quick-jumper="true"
        :show-size-changer="true"
        :show-total="(total) => `共 ${total} 条可转明细`"
        :total="itemPageState.total"
        size="small"
        @change="handleItemPageChange"
        @show-size-change="handleItemPageChange"
      />
    </div>
  </Modal>
</template>

<style scoped>
.purchase-in-sale-cart-item-pager :deep(.ant-pagination),
.purchase-in-sale-cart-item-pager :deep(.ant-pagination-item),
.purchase-in-sale-cart-item-pager :deep(.ant-pagination-total-text),
.purchase-in-sale-cart-item-pager :deep(.ant-pagination-options),
.purchase-in-sale-cart-item-pager :deep(.ant-select),
.purchase-in-sale-cart-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.purchase-in-sale-cart-item-pager :deep(.ant-pagination-options-size-changer),
.purchase-in-sale-cart-item-pager :deep(.ant-select-single),
.purchase-in-sale-cart-item-pager :deep(.ant-select-selector) {
  min-height: 24px;
  height: 24px;
  box-sizing: border-box;
  line-height: 22px;
}
</style>
