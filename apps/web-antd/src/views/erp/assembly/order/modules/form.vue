<script lang="ts" setup>
import type { ErpAssemblyRecipeApi } from '#/api/erp/assembly/recipe';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Button,
  DatePicker,
  Input,
  message,
  Modal as AntModal,
  Pagination,
  Select,
  Table,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  cancelStartAssemblyOrder,
  completeAssemblyOrder,
  confirmAssemblyOrder,
  createAssemblyOrderDraft,
  ErpAssemblyOrderApi,
  getAssemblyAvailability,
  getAssemblyComponentBatchNoList,
  getAssemblyOrder,
  getAssemblyOrderItemPage,
  getAssemblyOrderUserSimplePage,
  reverseAssemblyOrder,
  reverseConfirmAssemblyOrder,
  startAssemblyOrder,
  updateAssemblyOrderDraft,
} from '#/api/erp/assembly/order';
import {
  getAssemblyRecipe,
  getAssemblyRecipeItemPage,
  getEnabledAssemblyRecipeOptionPage,
} from '#/api/erp/assembly/recipe';
import { getCustomerSimplePage } from '#/api/erp/sale/customer';
import { getStockWarehouseFilterOptionPage } from '#/api/erp/stock/warehouse';
import {
  formatAssemblyAmountInput,
  formatAssemblyAmountList,
  formatAssemblyNaturalDecimal,
  isAssemblyDecimalDraft,
  isAssemblyPositiveIntegerDraft,
  validateAssemblyDecimal,
  validateAssemblyPositiveInteger,
} from '#/views/erp/assembly/utils/decimal-input';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';

const emit = defineEmits(['success']);
const PAGE_SIZE = 20;
const { hasAccessByCodes } = useAccess();
const userStore = useUserStore();

type EditableOrderItem = ErpAssemblyOrderApi.OrderItem & {
  clientKey?: string;
  consumeQuantityText?: string;
  consumeQuantityTextVersion?: number;
};
type SourceMode = 'order' | 'recipe';

const formData = ref<ErpAssemblyOrderApi.Order>({
  setCount: 1,
  otherCost: 0,
  handlerId: userStore.userInfo?.id,
  assemblyTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  status: 10,
});
const forceReadonly = ref(false);
const setCountText = ref('1');
const otherCostText = ref('0.00');
const setCountTextVersion = ref(0);
const otherCostTextVersion = ref(0);
const sourceMode = ref<SourceMode>('recipe');
const recipeHeader = ref<ErpAssemblyRecipeApi.Recipe>();
const recipeOptions = ref<Record<string, any>[]>([]);
const warehouseOptions = ref<Record<string, any>[]>([]);
const outWarehouseOptions = ref<Record<string, any>[]>([]);
const customerOptions = ref<Record<string, any>[]>([]);
const handlerOptions = ref<Record<string, any>[]>([]);
const availability = ref<ErpAssemblyOrderApi.Availability>();
const pageNo = ref(1);
const pageSize = ref(PAGE_SIZE);
const sourceTotal = ref(0);
const pageRows = ref<EditableOrderItem[]>([]);
const pageCache = new Map<string, EditableOrderItem[]>();
const deletedIds = new Set<number>();
const loadingItems = ref(false);
let itemLoadVersion = 0;
let recipeLoadVersion = 0;
let modalOpenVersion = 0;
const batchOptions = ref<
  Record<
    string,
    Array<{ availableCount: number; label: string; value: string }>
  >
>({});

const isDraft = computed(() => (formData.value.status || 10) === 10);
const readonly = computed(
  () =>
    forceReadonly.value ||
    !isDraft.value ||
    !hasAccessByCodes([
      formData.value.id
        ? 'erp:assembly-order:update'
        : 'erp:assembly-order:create',
    ]),
);
const title = computed(() =>
  readonly.value
    ? '查看套件组装单'
    : formData.value.id
      ? '编辑套件组装单'
      : '新增套件组装单',
);
const canSaveDraft = computed(
  () =>
    !readonly.value &&
    isDraft.value &&
    hasAccessByCodes([
      formData.value.id
        ? 'erp:assembly-order:update'
        : 'erp:assembly-order:create',
    ]),
);
const canConfirm = computed(
  () => isDraft.value && hasAccessByCodes(['erp:assembly-order:confirm']),
);
const canReverseConfirm = computed(
  () =>
    formData.value.status === ErpAssemblyOrderApi.STATUS_CONFIRMED &&
    hasAccessByCodes(['erp:assembly-order:reverse-confirm']),
);
const canStart = computed(
  () =>
    formData.value.status === ErpAssemblyOrderApi.STATUS_CONFIRMED &&
    hasAccessByCodes(['erp:assembly-order:start']),
);
const canCancelStart = computed(
  () =>
    formData.value.status === ErpAssemblyOrderApi.STATUS_ASSEMBLING &&
    hasAccessByCodes(['erp:assembly-order:cancel-start']),
);
const canComplete = computed(
  () =>
    formData.value.status === ErpAssemblyOrderApi.STATUS_ASSEMBLING &&
    hasAccessByCodes(['erp:assembly-order:complete']),
);
const canReverseAssembly = computed(
  () =>
    formData.value.status === ErpAssemblyOrderApi.STATUS_COMPLETED &&
    hasAccessByCodes(['erp:assembly-order:reverse-assembly']),
);

function syncModalPresentation() {
  modalApi.setState({
    showConfirmButton: canSaveDraft.value,
    title: title.value,
  });
}
const laborCostPerSet = computed(() =>
  Number(
    formData.value.laborCostPerSet ?? recipeHeader.value?.laborCostPerSet ?? 0,
  ),
);
const laborCostPerSetText = computed(() =>
  formatAssemblyAmountInput(laborCostPerSet.value),
);
const laborCostTotal = computed(
  () => laborCostPerSet.value * Number(formData.value.setCount || 0),
);
const assemblyExtraCost = computed(
  () => laborCostTotal.value + Number(formData.value.otherCost || 0),
);
const maxAssemblableCount = computed(
  () => availability.value?.maxAssemblableCount ?? 0,
);
const availabilityMap = computed(
  () =>
    new Map(
      (availability.value?.items || []).map((item) => [item.productId, item]),
    ),
);
const totalRequiredQuantity = computed(() => {
  const availabilityItems = availability.value?.items || [];
  if (availabilityItems.length > 0) {
    const quantityPerSet = availabilityItems.reduce(
      (sum, item) => sum + Number(item.quantityPerSet || 0),
      0,
    );
    return quantityPerSet * Number(formData.value.setCount || 0);
  }
  return pageRows.value.reduce(
    (sum, item) => sum + Number(item.requiredQuantity || 0),
    0,
  );
});
const detailPageCount = computed(() =>
  Math.ceil(Number(sourceTotal.value || 0) / Number(pageSize.value || 1)),
);
const sourceWarehouseId = computed(
  () => formData.value.outWarehouseId || formData.value.warehouseId || 0,
);
const outWarehouseDisplayName = computed(() => {
  if (formData.value.outWarehouseName) return formData.value.outWarehouseName;
  if (!formData.value.outWarehouseId && formData.value.warehouseName) {
    return formData.value.warehouseName;
  }
  const selected = outWarehouseOptions.value.find(
    (item) => Number(item.id) === Number(sourceWarehouseId.value),
  );
  if (selected?.displayName) return selected.displayName;
  const inbound = warehouseOptions.value.find(
    (item) => Number(item.id) === Number(sourceWarehouseId.value),
  );
  return inbound?.displayName || '-';
});

function formatDateTime(value?: number | string) {
  if (value === null || value === undefined || value === '') return '-';
  const date = dayjs(value);
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm:ss') : '-';
}

function warehouseMoveStatusName(status?: number) {
  if (status === 20) return '已完成';
  if (status === 30) return '已作废';
  return status === undefined || status === null ? '-' : `状态 ${status}`;
}

function assemblyStatusName(status?: number) {
  if (status === ErpAssemblyOrderApi.STATUS_CONFIRMED) return '已确认';
  if (status === ErpAssemblyOrderApi.STATUS_ASSEMBLING) return '装配中';
  if (status === ErpAssemblyOrderApi.STATUS_COMPLETED) return '已完成';
  if (status === ErpAssemblyOrderApi.STATUS_LEGACY_VOIDED) {
    return '历史已作废';
  }
  return '草稿';
}

function resetState() {
  itemLoadVersion += 1;
  recipeLoadVersion += 1;
  formData.value = {
    setCount: 1,
    otherCost: 0,
    handlerId: userStore.userInfo?.id,
    assemblyTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    status: 10,
  };
  setCountText.value = '1';
  otherCostText.value = '0.00';
  setCountTextVersion.value = 0;
  otherCostTextVersion.value = 0;
  forceReadonly.value = false;
  sourceMode.value = 'recipe';
  recipeHeader.value = undefined;
  recipeOptions.value = [];
  warehouseOptions.value = [];
  outWarehouseOptions.value = [];
  customerOptions.value = [];
  handlerOptions.value = userStore.userInfo?.id
    ? [
        {
          id: userStore.userInfo.id,
          nickname:
            userStore.userInfo.nickname || userStore.userInfo.realName || '',
        },
      ]
    : [];
  availability.value = undefined;
  pageNo.value = 1;
  pageSize.value = PAGE_SIZE;
  sourceTotal.value = 0;
  pageRows.value = [];
  pageCache.clear();
  deletedIds.clear();
  batchOptions.value = {};
}

function recipeItemToOrderItem(
  item: ErpAssemblyRecipeApi.RecipeItem,
): EditableOrderItem {
  const required =
    Number(item.quantityPerSet || 0) * Number(formData.value.setCount || 0);
  return {
    clientKey: `recipe-${item.id}-${Date.now()}-${Math.random()}`,
    recipeItemId: item.id!,
    productId: item.productId,
    productCode: item.productCode,
    productName: item.productName,
    productFactoryCode: item.productFactoryCode,
    productStandard: item.productStandard,
    productUnitName: item.productUnitName,
    productDrawingNo: item.productDrawingNo,
    productOriginPlace: item.productOriginPlace,
    productBrand: item.productBrand,
    productVehicleModel: item.productVehicleModel,
    productFeatureCode: item.productFeatureCode,
    productRetailPrice: item.productRetailPrice,
    batchNoEnabled: item.batchNoEnabled,
    quantityPerSet: Number(item.quantityPerSet),
    requiredQuantity: required,
    consumeQuantity: required,
    consumeQuantityText: formatAssemblyNaturalDecimal(required),
    remark: item.remark,
  };
}

function hydrateOrderItem(
  item: ErpAssemblyOrderApi.OrderItem,
): EditableOrderItem {
  return {
    ...item,
    consumeQuantityText: formatAssemblyNaturalDecimal(item.consumeQuantity),
  };
}

function setConsumeQuantity(row: EditableOrderItem, value: number) {
  row.consumeQuantity = value;
  row.consumeQuantityText = formatAssemblyNaturalDecimal(value);
}

function updateOtherCostText(value: unknown) {
  const text = String(value ?? '');
  if (!isAssemblyDecimalDraft(text)) {
    message.warning('其他成本最多支持 18 位整数和 6 位小数');
    otherCostTextVersion.value += 1;
    return;
  }
  otherCostText.value = text;
  const parsed = validateAssemblyDecimal(text, {
    allowZero: true,
    label: '其他成本',
  });
  if (parsed.ok) formData.value.otherCost = parsed.value;
}

function blurOtherCost() {
  const parsed = validateAssemblyDecimal(otherCostText.value, {
    allowZero: true,
    label: '其他成本',
  });
  if (!parsed.ok) {
    message.warning(parsed.message);
    otherCostText.value = formatAssemblyAmountInput(formData.value.otherCost);
    return;
  }
  formData.value.otherCost = parsed.value;
  otherCostText.value = formatAssemblyAmountInput(otherCostText.value);
}

function updateSetCountText(value: unknown) {
  const text = String(value ?? '');
  if (!isAssemblyPositiveIntegerDraft(text)) {
    message.warning('组装套数必须是正整数');
    setCountTextVersion.value += 1;
    return;
  }
  setCountText.value = text;
  const parsed = validateAssemblyPositiveInteger(text);
  if (!parsed.ok) return;
  formData.value.setCount = parsed.value;
  handleSetCountChange();
}

function blurSetCount() {
  const parsed = validateAssemblyPositiveInteger(setCountText.value);
  if (!parsed.ok) {
    message.warning(parsed.message);
    setCountText.value = String(formData.value.setCount || 1);
    return;
  }
  formData.value.setCount = parsed.value;
  setCountText.value = String(parsed.value);
  handleSetCountChange();
}

function updateConsumeQuantityText(row: EditableOrderItem, value: unknown) {
  const text = String(value ?? '');
  if (!isAssemblyDecimalDraft(text)) {
    message.warning('消耗数量最多支持 18 位整数和 6 位小数');
    row.consumeQuantityTextVersion = (row.consumeQuantityTextVersion ?? 0) + 1;
    return;
  }
  row.consumeQuantityText = text;
}

function blurConsumeQuantity(row: EditableOrderItem) {
  const parsed = validateAssemblyDecimal(
    row.consumeQuantityText ?? row.consumeQuantity,
    { label: '消耗数量' },
  );
  if (!parsed.ok) {
    message.warning(parsed.message);
    row.consumeQuantityText = formatAssemblyNaturalDecimal(row.consumeQuantity);
    return;
  }
  row.consumeQuantity = parsed.value;
  row.consumeQuantityText = formatAssemblyNaturalDecimal(
    row.consumeQuantityText,
  );
}

function findCachedRow(id?: number) {
  if (!id) return undefined;
  for (const rows of pageCache.values()) {
    const row = rows.find((item) => item.id === id);
    if (row) return row;
  }
  return undefined;
}

function findCachedRecipeGroup(recipeItemId?: number) {
  if (!recipeItemId) return [] as EditableOrderItem[];
  for (const rows of pageCache.values()) {
    const group = rows.filter((item) => item.recipeItemId === recipeItemId);
    if (group.length > 0) return group;
  }
  return [] as EditableOrderItem[];
}

async function cacheRows(
  page: number,
  targetPageSize: number,
  rows: EditableOrderItem[],
) {
  pageCache.set(`${targetPageSize}:${page}`, rows);
  pageRows.value = rows;
  await refreshBatchOptions(rows);
}

async function loadItemPage(
  targetPage = pageNo.value,
  targetPageSize = pageSize.value,
) {
  const loadVersion = ++itemLoadVersion;
  pageNo.value = targetPage;
  pageSize.value = targetPageSize;
  const cached = pageCache.get(`${targetPageSize}:${targetPage}`);
  if (cached) {
    pageRows.value = cached;
    await refreshBatchOptions(cached);
    return;
  }
  if (!formData.value.recipeId) {
    pageRows.value = [];
    return;
  }
  loadingItems.value = true;
  try {
    if (sourceMode.value === 'order' && formData.value.id) {
      const result = await getAssemblyOrderItemPage({
        orderId: formData.value.id,
        pageNo: targetPage,
        pageSize: targetPageSize,
      });
      if (loadVersion !== itemLoadVersion) return;
      sourceTotal.value = result.total;
      await cacheRows(
        targetPage,
        targetPageSize,
        (result.list || [])
          .filter((row) => !row.id || !deletedIds.has(row.id))
          .map((row) => findCachedRow(row.id) || hydrateOrderItem(row)),
      );
    } else {
      const result = await getAssemblyRecipeItemPage({
        recipeId: formData.value.recipeId!,
        pageNo: targetPage,
        pageSize: targetPageSize,
      });
      if (loadVersion !== itemLoadVersion) return;
      sourceTotal.value = result.total;
      const rows = (result.list || []).flatMap((item) => {
        const cachedGroup = findCachedRecipeGroup(item.id);
        return cachedGroup.length > 0
          ? cachedGroup
          : [recipeItemToOrderItem(item)];
      });
      await cacheRows(targetPage, targetPageSize, rows);
    }
  } finally {
    if (loadVersion === itemLoadVersion) {
      loadingItems.value = false;
    }
  }
}

async function handleRecipeChange(value?: unknown) {
  const loadVersion = ++recipeLoadVersion;
  const recipeId =
    value === null || value === undefined ? undefined : Number(value);
  pageCache.clear();
  pageRows.value = [];
  pageNo.value = 1;
  sourceTotal.value = 0;
  recipeHeader.value = undefined;
  formData.value.finishedBatchNo = undefined;
  if (!recipeId) {
    formData.value.recipeId = undefined;
    return;
  }
  formData.value.recipeId = recipeId;
  sourceMode.value = 'recipe';
  const header = await getAssemblyRecipe(recipeId, false);
  if (loadVersion !== recipeLoadVersion) return;
  recipeHeader.value = header;
  if (header) {
    recipeOptions.value = [
      {
        ...header,
        optionLabel:
          `${header.moduleCode || header.productCode || ''} ${header.moduleName || header.productName || ''}`.trim(),
      },
    ];
  }
  await loadItemPage(1, pageSize.value);
  await refreshAvailability();
}

function handleSetCountChange() {
  const setCount = Number(formData.value.setCount || 0);
  const cachedRows = [...pageCache.values()].flat();
  const uniqueRows = [
    ...new Map(cachedRows.map((row) => [rowKey(row), row])).values(),
  ];
  const groups = new Map<number, EditableOrderItem[]>();
  uniqueRows.forEach((row) => {
    const list = groups.get(row.recipeItemId) || [];
    list.push(row);
    groups.set(row.recipeItemId, list);
  });
  groups.forEach((items) => {
    const required = Number(items[0]?.quantityPerSet || 0) * setCount;
    items.forEach((item) => {
      item.requiredQuantity = required;
    });
    if (
      items.length === 1 &&
      items[0] &&
      (!items[0].batchNoEnabled || sourceMode.value === 'recipe')
    ) {
      setConsumeQuantity(items[0], required);
    }
  });
}

function normalizeRequiredQuantities(rows: EditableOrderItem[]) {
  const groups = new Map<number, EditableOrderItem[]>();
  rows.forEach((row) => {
    const list = groups.get(row.recipeItemId) || [];
    list.push(row);
    groups.set(row.recipeItemId, list);
  });
  groups.forEach((items) => {
    const required =
      Number(items[0]?.quantityPerSet || 0) *
      Number(formData.value.setCount || 0);
    items.forEach((item) => {
      item.requiredQuantity = required;
    });
    if (items.length === 1 && items[0]) {
      setConsumeQuantity(items[0], required);
    }
  });
  return rows;
}

function batchKey(row: EditableOrderItem) {
  return `${row.productId || 0}-${sourceWarehouseId.value}`;
}

async function refreshBatchOptions(rows: EditableOrderItem[] = pageRows.value) {
  if (!sourceWarehouseId.value) return;
  await Promise.all(
    rows.map(async (row) => {
      if (!row.batchNoEnabled || !row.productId) {
        row.batchNo = undefined;
        return;
      }
      const key = batchKey(row);
      if (batchOptions.value[key]) return;
      const list = await getAssemblyComponentBatchNoList({
        productId: row.productId,
        warehouseId: sourceWarehouseId.value,
      });
      const options = (list || []).map((item) => ({
        label: `${item.batchNo}（可用 ${formatAssemblyNaturalDecimal(item.availableCount, '0')}）`,
        value: item.batchNo,
        availableCount: Number(item.availableCount || 0),
      }));
      if (row.batchNo && !options.some((item) => item.value === row.batchNo)) {
        options.unshift({
          label: row.batchNo,
          value: row.batchNo,
          availableCount: 0,
        });
      }
      batchOptions.value[key] = options;
    }),
  );
}

async function handleOutWarehouseChange() {
  const selected = outWarehouseOptions.value.find(
    (item) => Number(item.id) === Number(formData.value.outWarehouseId),
  );
  formData.value.outWarehouseName = selected?.displayName;
  batchOptions.value = {};
  for (const rows of pageCache.values()) {
    rows.forEach((row) => {
      row.batchNo = undefined;
    });
  }
  await refreshBatchOptions();
  await refreshAvailability();
}

async function handleWarehouseChange() {
  const selected = warehouseOptions.value.find(
    (item) => Number(item.id) === Number(formData.value.warehouseId),
  );
  formData.value.warehouseName = selected?.displayName;
  if (formData.value.outWarehouseId) return;
  batchOptions.value = {};
  for (const rows of pageCache.values()) {
    rows.forEach((row) => {
      row.batchNo = undefined;
    });
  }
  await refreshBatchOptions();
  await refreshAvailability();
}

async function refreshAvailability() {
  if (!formData.value.recipeId || !sourceWarehouseId.value) {
    availability.value = undefined;
    return;
  }
  availability.value = await getAssemblyAvailability({
    recipeId: formData.value.recipeId,
    warehouseId: sourceWarehouseId.value,
  });
}

function splitBatch(row: EditableOrderItem) {
  const index = pageRows.value.indexOf(row);
  if (index === -1) return;
  const copy: EditableOrderItem = {
    ...row,
    id: undefined,
    clientKey: `split-${row.recipeItemId}-${Date.now()}-${Math.random()}`,
    batchNo: undefined,
    consumeQuantity: 0,
    consumeQuantityText: '0',
  };
  pageRows.value.splice(index + 1, 0, copy);
  pageCache.set(`${pageSize.value}:${pageNo.value}`, pageRows.value);
}

function removeSplit(row: EditableOrderItem) {
  const siblings = pageRows.value.filter(
    (item) => item.recipeItemId === row.recipeItemId,
  );
  if (siblings.length <= 1) {
    message.warning('每个组成配件至少保留一条消耗明细');
    return;
  }
  if (row.id) deletedIds.add(row.id);
  pageRows.value = pageRows.value.filter((item) => item !== row);
  pageCache.set(`${pageSize.value}:${pageNo.value}`, pageRows.value);
}

function rowKey(row: EditableOrderItem) {
  return row.id || row.clientKey || `${row.recipeItemId}-${row.batchNo || ''}`;
}

async function fetchAllItems(): Promise<EditableOrderItem[]> {
  const chunkSize = 100;
  const resultRows: EditableOrderItem[] = [];
  const pages = Math.max(1, Math.ceil(sourceTotal.value / chunkSize));
  if (sourceMode.value === 'order' && formData.value.id) {
    for (let current = 1; current <= pages; current += 1) {
      const result = await getAssemblyOrderItemPage({
        orderId: formData.value.id,
        pageNo: current,
        pageSize: chunkSize,
      });
      resultRows.push(
        ...(result.list || []).map((row) => hydrateOrderItem(row)),
      );
    }
    const edits = new Map<number, EditableOrderItem>();
    const additions = new Map<number | string, EditableOrderItem>();
    for (const rows of pageCache.values()) {
      rows.forEach((row) =>
        row.id ? edits.set(row.id, row) : additions.set(rowKey(row), row),
      );
    }
    return normalizeRequiredQuantities([
      ...resultRows
        .filter((row) => !row.id || !deletedIds.has(row.id))
        .map((row) => (row.id && edits.get(row.id)) || row),
      ...additions.values(),
    ]);
  }
  const cachedGroups = new Map<number, EditableOrderItem[]>();
  for (const rows of pageCache.values()) {
    const groupsOnPage = new Map<number, EditableOrderItem[]>();
    rows.forEach((row) => {
      const list = groupsOnPage.get(row.recipeItemId) || [];
      list.push(row);
      groupsOnPage.set(row.recipeItemId, list);
    });
    groupsOnPage.forEach((rowsOnPage, recipeItemId) =>
      cachedGroups.set(recipeItemId, rowsOnPage),
    );
  }
  for (let current = 1; current <= pages; current += 1) {
    const result = await getAssemblyRecipeItemPage({
      recipeId: formData.value.recipeId!,
      pageNo: current,
      pageSize: chunkSize,
    });
    for (const recipeItem of result.list || []) {
      const cached = cachedGroups.get(recipeItem.id!);
      resultRows.push(...(cached || [recipeItemToOrderItem(recipeItem)]));
    }
  }
  return normalizeRequiredQuantities(resultRows);
}

async function buildPayload() {
  if (!formData.value.recipeId || !formData.value.warehouseId) {
    message.warning('请选择组装件和入货仓');
    return;
  }
  const setCount = validateAssemblyPositiveInteger(setCountText.value);
  if (!setCount.ok) {
    message.warning(setCount.message);
    return;
  }
  if (availability.value && setCount.value > maxAssemblableCount.value) {
    message.warning(`当前配件来源仓最多可组装 ${maxAssemblableCount.value} 个`);
    return;
  }
  if (
    recipeHeader.value?.batchNoEnabled &&
    !formData.value.finishedBatchNo?.trim()
  ) {
    message.warning('该成品启用了批次管理，请填写成品批次号');
    return;
  }
  const otherCost = validateAssemblyDecimal(otherCostText.value, {
    allowZero: true,
    label: '其他成本',
  });
  if (!otherCost.ok) {
    message.warning(otherCost.message);
    return;
  }
  const allItems = await fetchAllItems();
  if (allItems.length === 0) {
    message.warning('组装单缺少组成配件');
    return;
  }
  const groups = new Map<number, EditableOrderItem[]>();
  const consumeQuantities = new Map<EditableOrderItem, number>();
  allItems.forEach((row) => {
    const list = groups.get(row.recipeItemId) || [];
    list.push(row);
    groups.set(row.recipeItemId, list);
  });
  for (const row of allItems) {
    const parsed = validateAssemblyDecimal(
      row.consumeQuantityText ?? row.consumeQuantity,
      { label: '消耗数量' },
    );
    if (!parsed.ok) {
      message.warning(parsed.message);
      return;
    }
    consumeQuantities.set(row, parsed.value);
  }
  for (const items of groups.values()) {
    const required =
      Number(items[0]?.quantityPerSet || items[0]?.requiredQuantity || 0) *
      setCount.value;
    const actual = items.reduce(
      (sum, item) => sum + (consumeQuantities.get(item) || 0),
      0,
    );
    if (Math.abs(required - actual) > 0.000_001) {
      message.warning(
        `配件 ${items[0]?.productName || items[0]?.productCode || ''} 的批次消耗合计应为 ${required}`,
      );
      return;
    }
    if (items.some((item) => item.batchNoEnabled && !item.batchNo?.trim())) {
      message.warning(
        `请选择配件 ${items[0]?.productName || items[0]?.productCode || ''} 的消耗批次`,
      );
      return;
    }
  }
  return {
    ...formData.value,
    setCount: setCount.value,
    otherCost: otherCost.value,
    assemblyTime:
      formData.value.assemblyTime || dayjs().format('YYYY-MM-DD HH:mm:ss'),
    finishedBatchNo: formData.value.finishedBatchNo?.trim() || undefined,
    items: allItems.map((row) => ({
      id: row.id,
      recipeItemId: row.recipeItemId,
      batchNo: row.batchNo?.trim() || undefined,
      consumeQuantity: consumeQuantities.get(row)!,
      remark: row.remark,
    })),
  } as ErpAssemblyOrderApi.Order;
}

async function persistDraft(payload: ErpAssemblyOrderApi.Order) {
  if (payload.id) {
    await updateAssemblyOrderDraft(payload);
    return payload.id;
  }
  const id = await createAssemblyOrderDraft(payload);
  formData.value.id = id;
  return id;
}

async function applyLoadedOrder(data: ErpAssemblyOrderApi.Order) {
  const formattedAssemblyTime = formatDateTime(data.assemblyTime);
  formData.value = {
    ...data,
    assemblyTime:
      formattedAssemblyTime === '-' ? undefined : formattedAssemblyTime,
  };
  setCountText.value = String(data.setCount || 1);
  otherCostText.value = formatAssemblyAmountInput(data.otherCost);
  sourceMode.value = 'order';
  recipeHeader.value = {
    id: data.recipeId,
    productId: data.productId!,
    moduleCode: data.recipeModuleCode,
    moduleName: data.recipeModuleName,
    laborCostPerSet: data.laborCostPerSet,
    productCode: data.productCode,
    productName: data.productName,
    batchNoEnabled: data.batchNoEnabled,
  };
  recipeOptions.value = [
    {
      ...recipeHeader.value,
      optionLabel:
        `${data.recipeModuleCode || data.productCode || ''} ${data.recipeModuleName || data.productName || ''}`.trim(),
    },
  ];
  warehouseOptions.value = [
    { id: data.warehouseId, displayName: data.warehouseName },
  ];
  outWarehouseOptions.value = [
    ...(data.outWarehouseId
      ? [{ id: data.outWarehouseId, displayName: data.outWarehouseName }]
      : []),
  ];
  customerOptions.value = data.customerId
    ? [{ id: data.customerId, name: data.customerName }]
    : [];
  handlerOptions.value = data.handlerId
    ? [{ id: data.handlerId, nickname: data.handlerName }]
    : [];
  sourceTotal.value = data.itemCount || 0;
  pageCache.clear();
  deletedIds.clear();
  await loadItemPage(1, PAGE_SIZE);
  await refreshAvailability();
  syncModalPresentation();
}

async function reloadCurrentOrder() {
  if (!formData.value.id) return;
  const data = await getAssemblyOrder(formData.value.id, false);
  if (!data) {
    message.error('套件组装单不存在或无权访问');
    await modalApi.close();
    return;
  }
  await applyLoadedOrder(data);
}

async function saveDraft() {
  const payload = await buildPayload();
  if (!payload) return;
  modalApi.lock();
  try {
    await persistDraft(payload);
    message.success('草稿保存成功');
    emit('success');
    await reloadCurrentOrder();
  } finally {
    modalApi.unlock();
  }
}

async function confirmDraft() {
  const payload = await buildPayload();
  if (!payload) return;
  modalApi.lock();
  try {
    const id = await persistDraft(payload);
    await confirmAssemblyOrder(id);
    message.success('确认装配成功');
    emit('success');
    await reloadCurrentOrder();
  } finally {
    modalApi.unlock();
  }
}

async function executeWorkflowAction(
  api: (id: number) => Promise<unknown>,
  successText: string,
  afterSuccess?: () => void,
) {
  if (!formData.value.id) return;
  modalApi.lock();
  try {
    await api(formData.value.id);
    afterSuccess?.();
    message.success(successText);
    emit('success');
    await reloadCurrentOrder();
  } finally {
    modalApi.unlock();
  }
}

function confirmWorkflowAction(options: {
  api: (id: number) => Promise<unknown>;
  afterSuccess?: () => void;
  content: string;
  successText: string;
  title: string;
}) {
  AntModal.confirm({
    title: options.title,
    content: options.content,
    okText: '确认',
    cancelText: '取消',
    onOk: () =>
      executeWorkflowAction(
        options.api,
        options.successText,
        options.afterSuccess,
      ),
  });
}

function requestConfirmAssembly() {
  AntModal.confirm({
    title: '确认装配',
    content: '确认后单据将变为只读；如需修改，必须先执行反确认装配。',
    okText: '确认装配',
    cancelText: '取消',
    onOk: confirmDraft,
  });
}

function requestReverseConfirm() {
  confirmWorkflowAction({
    api: reverseConfirmAssemblyOrder,
    afterSuccess: () => {
      forceReadonly.value = false;
    },
    title: '反确认装配',
    content: '反确认后单据将回到草稿状态并恢复编辑。',
    successText: '反确认装配成功',
  });
}

function requestStartAssembly() {
  confirmWorkflowAction({
    api: startAssemblyOrder,
    title: '开始装配',
    content: '开始装配将重新检查当前可用库存，但暂不产生库存流水。',
    successText: '已开始装配',
  });
}

function requestCancelStart() {
  confirmWorkflowAction({
    api: cancelStartAssemblyOrder,
    title: '取消开始装配',
    content: '取消后单据回到已确认状态，不影响库存。',
    successText: '已取消开始装配',
  });
}

function requestCompleteAssembly() {
  confirmWorkflowAction({
    api: completeAssemblyOrder,
    title: '完成装配',
    content: '完成后将立即扣减组成配件、成品入库，并在跨仓时自动完成移货。',
    successText: '组装完成，库存及跨仓移货已同步处理',
  });
}

function requestReverseAssembly() {
  confirmWorkflowAction({
    api: reverseAssemblyOrder,
    title: '反装配',
    content: '反装配将立即冲销成品、退回组成配件，并同步冲销自动移货单。',
    successText: '反装配成功，库存及自动移货已同步冲销',
  });
}

const [Modal, modalApi] = useVbenModal({
  onConfirm: saveDraft,
  async onOpenChange(open) {
    const openVersion = ++modalOpenVersion;
    if (!open) {
      resetState();
      return;
    }
    resetState();
    modalApi.setState({ fullscreen: true });
    const source = modalApi.getData<
      ErpAssemblyOrderApi.Order & { readonly?: boolean; type?: string }
    >();
    forceReadonly.value = !!source?.readonly || source?.type === 'detail';
    if (source?.id) {
      formData.value.id = source.id;
    }
    syncModalPresentation();
    if (!source?.id) {
      if (source?.recipeId) {
        formData.value.recipeId = source.recipeId;
        await handleRecipeChange(source.recipeId);
      }
      syncModalPresentation();
      return;
    }
    modalApi.lock();
    try {
      const data = await getAssemblyOrder(source.id, false);
      if (openVersion !== modalOpenVersion) return;
      if (!data) {
        message.error('套件组装单不存在或无权访问');
        await modalApi.close();
        return;
      }
      await applyLoadedOrder(data);
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal
    class="!w-full"
    bordered
    cancel-text="关闭"
    confirm-text="保存草稿"
    content-class="p-0"
  >
    <template
      v-if="
        canConfirm ||
        canReverseConfirm ||
        canStart ||
        canCancelStart ||
        canComplete ||
        canReverseAssembly
      "
      #prepend-footer
    >
      <Button v-if="canReverseConfirm" danger @click="requestReverseConfirm">
        反确认装配
      </Button>
      <Button v-if="canCancelStart" danger @click="requestCancelStart">
        取消开始装配
      </Button>
      <Button v-if="canReverseAssembly" danger @click="requestReverseAssembly">
        反装配
      </Button>
      <Button v-if="canConfirm" type="primary" @click="requestConfirmAssembly">
        确认装配
      </Button>
      <Button v-if="canStart" type="primary" @click="requestStartAssembly">
        开始装配
      </Button>
      <Button
        v-if="canComplete"
        type="primary"
        danger
        @click="requestCompleteAssembly"
      >
        完成装配
      </Button>
    </template>
    <div class="assembly-form">
      <section class="assembly-section">
        <header>
          <span>套件组装信息</span>
          <span v-if="readonly" class="document-status">
            {{ assemblyStatusName(formData.status) }}
          </span>
        </header>
        <div class="assembly-fields">
          <div class="field">
            <label>对象（客户）</label>
            <ErpLazyPageSelect
              v-model:value="formData.customerId"
              :api="getCustomerSimplePage"
              :options="customerOptions"
              label-field="name"
              value-field="id"
              :page-size="10"
              placeholder="搜索并选择客户"
              show-search
              allow-clear
              :disabled="readonly"
            />
          </div>
          <div class="field">
            <label>单号</label>
            <Input :value="formData.no || '系统自动生成'" disabled />
          </div>
          <div class="field">
            <label>日期</label>
            <DatePicker
              v-model:value="formData.assemblyTime"
              show-time
              value-format="YYYY-MM-DD HH:mm:ss"
              class="w-full"
              disabled
            />
          </div>
          <div class="field">
            <label>经办人</label>
            <ErpLazyPageSelect
              v-model:value="formData.handlerId"
              :api="getAssemblyOrderUserSimplePage"
              :options="handlerOptions"
              label-field="nickname"
              value-field="id"
              :page-size="10"
              placeholder="搜索并选择经办人"
              show-search
              allow-clear
              :disabled="readonly"
            />
          </div>
          <div class="field col-span-2">
            <label>配件（组装件） <b>*</b></label>
            <ErpLazyPageSelect
              v-model:value="formData.recipeId"
              :api="getEnabledAssemblyRecipeOptionPage"
              :options="recipeOptions"
              label-field="optionLabel"
              value-field="id"
              :page-size="10"
              placeholder="搜索并选择模块管理中的组装件"
              show-search
              :disabled="readonly || !!formData.id"
              @change="handleRecipeChange"
            />
          </div>
          <div class="field">
            <label>人工费用（每套）</label>
            <Input
              :value="laborCostPerSetText"
              type="text"
              inputmode="decimal"
              class="w-full"
              disabled
            />
          </div>
          <div class="field">
            <label>其他成本</label>
            <Input
              :key="`other-cost-${otherCostTextVersion}`"
              :value="otherCostText"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              class="w-full"
              :disabled="readonly"
              @update:value="updateOtherCostText"
              @blur="blurOtherCost"
            />
          </div>
          <div class="field">
            <label>数量 <b>*</b></label>
            <div class="quantity-field">
              <Input
                :key="`set-count-${setCountTextVersion}`"
                :value="setCountText"
                type="text"
                inputmode="numeric"
                autocomplete="off"
                class="w-full"
                :disabled="readonly"
                @update:value="updateSetCountText"
                @blur="blurSetCount"
              />
              <span v-if="!readonly" class="availability-tip">
                允许最大组装数：<b>{{ maxAssemblableCount }}</b>
              </span>
            </div>
          </div>
          <div class="field">
            <label>入货仓 <b>*</b></label>
            <ErpLazyPageSelect
              v-model:value="formData.warehouseId"
              :api="getStockWarehouseFilterOptionPage"
              :options="warehouseOptions"
              label-field="displayName"
              value-field="id"
              :page-size="10"
              placeholder="请选择成品入库仓库"
              show-search
              :disabled="readonly"
              @change="handleWarehouseChange"
            />
          </div>
          <div class="field">
            <label>仓位</label>
            <Input
              v-model:value="formData.shelf"
              :disabled="readonly"
              :maxlength="64"
              placeholder="请输入成品入库仓位"
            />
          </div>
          <div class="field">
            <label>出货仓</label>
            <ErpLazyPageSelect
              v-model:value="formData.outWarehouseId"
              :api="getStockWarehouseFilterOptionPage"
              :options="outWarehouseOptions"
              label-field="displayName"
              value-field="id"
              :page-size="10"
              placeholder="选填；不填则从入货仓取配件"
              show-search
              allow-clear
              :disabled="readonly"
              @change="handleOutWarehouseChange"
            />
          </div>
          <div class="field">
            <label>成品批次 <b v-if="recipeHeader?.batchNoEnabled">*</b></label>
            <Input
              v-model:value="formData.finishedBatchNo"
              :disabled="readonly || !recipeHeader?.batchNoEnabled"
              :maxlength="64"
              :placeholder="
                recipeHeader?.batchNoEnabled
                  ? '请输入成品入库批次'
                  : '该组装件未启用批次管理'
              "
            />
          </div>
          <div class="field col-span-3">
            <label>备注</label>
            <Input
              v-model:value="formData.remark"
              :disabled="readonly"
              :maxlength="500"
            />
          </div>
        </div>
        <div v-if="recipeHeader || formData.id" class="assembly-summary">
          <span
            >配件编码：<b>{{
              formData.productCode || recipeHeader?.productCode || '-'
            }}</b></span
          >
          <span
            >模块名称：<b>{{
              formData.recipeModuleName || recipeHeader?.moduleName || '-'
            }}</b></span
          >
          <span
            >总用量：<b>{{
              formatAssemblyNaturalDecimal(totalRequiredQuantity, '0')
            }}</b></span
          >
          <span
            >页数：<b>{{ detailPageCount }}</b></span
          >
          <span
            >人工费合计：<b>{{
              formatAssemblyAmountList(laborCostTotal, '0.00')
            }}</b></span
          >
          <span
            >其他成本：<b>{{
              formatAssemblyAmountList(formData.otherCost, '0.00')
            }}</b></span
          >
          <span
            >配件来源仓：<b>{{ outWarehouseDisplayName }}</b></span
          >
          <span
            v-if="
              formData.outWarehouseId &&
              formData.outWarehouseId !== formData.warehouseId
            "
            >入库方式：<b>自动生成并完成移货单</b></span
          >
          <span
            >组装附加成本：<b>{{
              formatAssemblyAmountList(assemblyExtraCost, '0.00')
            }}</b></span
          >
          <span v-if="readonly"
            >材料成本：<b>{{
              formatAssemblyAmountList(formData.materialCost, '0.00')
            }}</b></span
          >
          <span v-if="readonly"
            >组装成本：<b>{{
              formatAssemblyAmountList(formData.totalCost, '0.00')
            }}</b></span
          >
          <span v-if="readonly"
            >成本价：<b>{{
              formatAssemblyAmountList(formData.unitCost, '0.00')
            }}</b></span
          >
          <span v-if="readonly && formData.warehouseMoveNo"
            >关联移货单：<b>{{ formData.warehouseMoveNo }}</b
            >（{{
              warehouseMoveStatusName(formData.warehouseMoveStatus)
            }}）</span
          >
        </div>
        <div v-if="readonly" class="product-summary">
          <span>规格：{{ formData.productStandard || '-' }}</span>
          <span>特征码：{{ formData.productFeatureCode || '-' }}</span>
          <span>产地：{{ formData.productOriginPlace || '-' }}</span>
          <span>车型：{{ formData.productVehicleModel || '-' }}</span>
          <span>品牌：{{ formData.productBrand || '-' }}</span>
          <span
            >零售价：{{
              formatAssemblyAmountList(formData.productRetailPrice, '0.00')
            }}</span
          >
        </div>
      </section>

      <section class="assembly-section">
        <header>组装配件明细</header>
        <Table
          size="small"
          :loading="loadingItems"
          :data-source="pageRows"
          :pagination="false"
          :row-key="rowKey"
          :scroll="{ x: 2550, y: 390 }"
        >
          <Table.Column v-if="!readonly" title="操作" :width="110">
            <template #default="{ record }">
              <Button
                v-if="record.batchNoEnabled"
                type="link"
                size="small"
                @click="splitBatch(record)"
              >
                替换/拆分
              </Button>
              <Button
                type="link"
                danger
                size="small"
                @click="removeSplit(record)"
              >
                删除
              </Button>
            </template>
          </Table.Column>
          <Table.Column title="序号" :width="60">
            <template #default="{ index }">
              {{ (pageNo - 1) * pageSize + index + 1 }}
            </template>
          </Table.Column>
          <Table.Column
            title="配件编码"
            data-index="productCode"
            :width="140"
          />
          <Table.Column
            title="零件名称"
            data-index="productName"
            :width="190"
          />
          <Table.Column
            title="车型"
            data-index="productVehicleModel"
            :width="120"
          />
          <Table.Column
            title="图号"
            data-index="productDrawingNo"
            :width="120"
          />
          <Table.Column title="仓库" :width="110">
            <template #default>{{ outWarehouseDisplayName }}</template>
          </Table.Column>
          <Table.Column
            title="产地"
            data-index="productOriginPlace"
            :width="100"
          />
          <Table.Column title="品牌" data-index="productBrand" :width="100" />
          <Table.Column
            title="供应商"
            data-index="productSupplierName"
            :width="150"
          />
          <Table.Column
            title="规格"
            data-index="productStandard"
            :width="120"
          />
          <Table.Column
            title="特征码"
            data-index="productFeatureCode"
            :width="110"
          />
          <Table.Column title="每套用量" :width="95">
            <template #default="{ record }">
              {{ formatAssemblyNaturalDecimal(record.quantityPerSet, '0') }}
            </template>
          </Table.Column>
          <Table.Column title="组装用量" :width="100">
            <template #default="{ record }">
              {{
                formatAssemblyNaturalDecimal(
                  Number(record.quantityPerSet || 0) *
                    Number(formData.setCount || 0),
                  '0',
                )
              }}
            </template>
          </Table.Column>
          <Table.Column title="单位" data-index="productUnitName" :width="70" />
          <Table.Column title="零售价" :width="90">
            <template #default="{ record }">
              {{ formatAssemblyAmountList(record.productRetailPrice) }}
            </template>
          </Table.Column>
          <Table.Column title="成本价" :width="95">
            <template #default="{ record }">
              {{ formatAssemblyAmountList(record.costPrice) }}
            </template>
          </Table.Column>
          <Table.Column title="成本金额" :width="105">
            <template #default="{ record }">
              {{ formatAssemblyAmountList(record.costAmount) }}
            </template>
          </Table.Column>
          <Table.Column title="库存" :width="90">
            <template #default="{ record }">
              {{
                formatAssemblyNaturalDecimal(
                  record.stockCount ??
                    availabilityMap.get(record.productId)?.stockCount ??
                    0,
                  '0',
                )
              }}
            </template>
          </Table.Column>
          <Table.Column title="本单占用" :width="95">
            <template #default="{ record }">
              {{ formatAssemblyNaturalDecimal(record.requiredQuantity, '0') }}
            </template>
          </Table.Column>
          <Table.Column title="缺少数量" :width="95">
            <template #default="{ record }">
              {{
                formatAssemblyNaturalDecimal(
                  record.shortageCount ??
                    Math.max(
                      0,
                      Number(record.requiredQuantity || 0) -
                        Number(
                          availabilityMap.get(record.productId)
                            ?.availableCount || 0,
                        ),
                    ),
                  '0',
                )
              }}
            </template>
          </Table.Column>
          <Table.Column title="消耗批次" :width="210">
            <template #default="{ record }">
              <Select
                v-if="record.batchNoEnabled"
                v-model:value="record.batchNo"
                :options="batchOptions[batchKey(record)] || []"
                :disabled="readonly || !sourceWarehouseId"
                show-search
                class="w-full"
                placeholder="请选择库存批次"
              />
              <Tag v-else>不启用批次</Tag>
            </template>
          </Table.Column>
          <Table.Column title="消耗数量" :width="135">
            <template #default="{ record }">
              <Input
                :key="`consume-${rowKey(record)}-${record.consumeQuantityTextVersion ?? 0}`"
                :value="record.consumeQuantityText"
                :disabled="readonly"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                class="w-full"
                @update:value="
                  (value) => updateConsumeQuantityText(record, value)
                "
                @blur="blurConsumeQuantity(record)"
              />
            </template>
          </Table.Column>
          <Table.Column title="备注" :width="160">
            <template #default="{ record }">
              <Input
                v-model:value="record.remark"
                :disabled="readonly"
                :maxlength="500"
              />
            </template>
          </Table.Column>
        </Table>
        <div class="flex justify-end p-3">
          <Pagination
            v-model:current="pageNo"
            v-model:page-size="pageSize"
            :total="sourceTotal"
            :page-size-options="['10', '20', '50', '100']"
            show-size-changer
            show-quick-jumper
            @change="loadItemPage"
          />
        </div>
      </section>

      <section v-if="formData.id" class="assembly-section audit-section">
        <header>审计信息</header>
        <div class="audit-grid">
          <span>创建人：{{ formData.creatorName || '-' }}</span>
          <span>编辑人：{{ formData.updaterName || '-' }}</span>
          <span>创建时间：{{ formatDateTime(formData.createTime) }}</span>
          <span>编辑时间：{{ formatDateTime(formData.updateTime) }}</span>
        </div>
      </section>
    </div>
  </Modal>
</template>

<style scoped>
.assembly-form {
  padding: 12px;
  background: hsl(var(--muted) / 28%);
}
.assembly-section {
  margin-bottom: 12px;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}
.assembly-section > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}
.assembly-fields {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 12px;
}
.field {
  min-width: 0;
}
.assembly-fields :deep(.ant-select),
.assembly-fields :deep(.ant-input-number),
.assembly-fields :deep(.ant-picker),
.assembly-fields :deep(.ant-input) {
  width: 100%;
  min-width: 0;
}
.field label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
.field label b {
  color: #f5222d;
}
.quantity-field {
  display: flex;
  align-items: center;
  gap: 10px;
}
.availability-tip {
  flex: none;
  font-size: 12px;
  color: #f5222d;
}
.document-status {
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #1677ff;
  background: #eaf3ff;
  border-radius: 12px;
}
.assembly-summary,
.product-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  padding: 10px 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  border-top: 1px solid hsl(var(--border));
}
.assembly-summary b {
  color: hsl(var(--foreground));
}
.audit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 32px;
  padding: 14px 16px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
.assembly-form,
.assembly-form :deep(.ant-table),
.assembly-form :deep(.ant-input),
.assembly-form :deep(.ant-input-number),
.assembly-form :deep(.ant-select),
.assembly-form :deep(.ant-picker),
.assembly-form :deep(.ant-btn) {
  font-size: 12px;
}
@media (max-width: 1000px) {
  .assembly-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
