<script lang="ts" setup>
import type { TableProps } from 'ant-design-vue';
import type { MallCouponApi } from '#/api/mall/promotion/coupon/coupon';
import type { MallCouponTemplateApi } from '#/api/mall/promotion/coupon/couponTemplate';
import type { SystemAreaApi } from '#/api/system/area';

import { computed, ref } from 'vue';

import { confirm, useVbenModal } from '@vben/common-ui';

import {
  Alert,
  Button,
  Descriptions,
  DescriptionsItem,
  message,
  Space,
  Table,
  Tag,
  TreeSelect,
} from 'ant-design-vue';

import {
  getAddressCouponTargetPage,
  sendCouponByAddress,
} from '#/api/mall/promotion/coupon/coupon';
import { getAreaTree } from '#/api/system/area';

defineOptions({ name: 'CouponAddressSendModal' });

const emit = defineEmits<{ success: [] }>();

const template = ref<MallCouponTemplateApi.CouponTemplate>();
const areaTree = ref<SystemAreaApi.Area[]>([]);
const selectedAreaIds = ref<number[]>([]);
const excludedUserIds = ref<Set<number>>(new Set());
const rows = ref<MallCouponApi.AddressTargetItem[]>([]);
const loading = ref(false);
const previewed = ref(false);
const pageNo = ref(1);
const pageSize = ref(10);
const pageTotal = ref(0);
const addressMatchedCount = ref(0);
const enabledMatchedCount = ref(0);
const requestId = ref('');
let previewRequestVersion = 0;

const columns: TableProps['columns'] = [
  { title: '会员编号', dataIndex: 'userId', width: 110 },
  { title: '昵称', dataIndex: 'nickname', width: 180 },
  { title: '手机号', dataIndex: 'mobile', width: 140 },
  { title: '命中行政区', dataIndex: 'matchedAreaNames', minWidth: 280 },
  { title: '发放状态', dataIndex: 'sendable', width: 150 },
];

const selectedRowKeys = computed(() =>
  rows.value
    .filter((row) => row.sendable && !excludedUserIds.value.has(row.userId))
    .map((row) => row.userId),
);

const rowSelection = computed<TableProps['rowSelection']>(() => ({
  preserveSelectedRowKeys: true,
  selectedRowKeys: selectedRowKeys.value,
  getCheckboxProps: (record: MallCouponApi.AddressTargetItem) => ({
    disabled: !record.sendable,
  }),
  onChange: (keys) => {
    const checkedIds = new Set(keys.map(Number));
    const next = new Set(excludedUserIds.value);
    for (const row of rows.value) {
      if (!row.sendable) continue;
      if (checkedIds.has(row.userId)) next.delete(row.userId);
      else next.add(row.userId);
    }
    excludedUserIds.value = next;
  },
}));

const pagination = computed(() => ({
  current: pageNo.value,
  pageSize: pageSize.value,
  total: pageTotal.value,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 名启用会员`,
}));

function resetPreview() {
  previewRequestVersion += 1;
  excludedUserIds.value = new Set();
  rows.value = [];
  loading.value = false;
  previewed.value = false;
  pageNo.value = 1;
  pageTotal.value = 0;
  addressMatchedCount.value = 0;
  enabledMatchedCount.value = 0;
}

async function loadPage(targetPage = pageNo.value) {
  if (!template.value || selectedAreaIds.value.length === 0) {
    resetPreview();
    return;
  }
  const requestVersion = ++previewRequestVersion;
  const areaIds = [...selectedAreaIds.value];
  loading.value = true;
  try {
    const data = await getAddressCouponTargetPage({
      templateId: template.value.id,
      areaIds,
      pageNo: targetPage,
      pageSize: pageSize.value,
    });
    if (requestVersion !== previewRequestVersion) return;
    pageNo.value = targetPage;
    rows.value = data.pageResult.list;
    pageTotal.value = data.pageResult.total;
    addressMatchedCount.value = data.addressMatchedCount;
    enabledMatchedCount.value = data.enabledMatchedCount;
    previewed.value = true;
  } finally {
    if (requestVersion === previewRequestVersion) loading.value = false;
  }
}

async function handleAreaChange() {
  resetPreview();
  if (selectedAreaIds.value.length > 0) await loadPage(1);
}

async function handleTableChange(pager: any) {
  pageSize.value = pager.pageSize || pageSize.value;
  await loadPage(pager.current || 1);
}

function restoreAll() {
  excludedUserIds.value = new Set();
  message.success('已恢复默认全选全部可发会员');
}

function createRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replaceAll(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (selectedAreaIds.value.length === 0) {
      message.warning('请至少选择一个收货地区');
      return;
    }
    if (!previewed.value) {
      message.warning('请先查询匹配会员');
      return;
    }
    try {
      await confirm({
        content: `确认按当前地区向“${template.value?.name}”的匹配会员发券吗？已人工排除 ${excludedUserIds.value.size} 人，提交时系统会再次校验会员状态与限领数量。`,
      });
    } catch {
      return;
    }
    modalApi.lock();
    try {
      const result = await sendCouponByAddress({
        requestId: requestId.value,
        templateId: template.value!.id,
        areaIds: selectedAreaIds.value,
        excludedUserIds: [...excludedUserIds.value],
      });
      message.success(
        `发放完成：成功 ${result.successCount} 人，停用跳过 ${result.disabledSkippedCount} 人，人工排除 ${result.excludedCount} 人，限领跳过 ${result.limitSkippedCount} 人`,
        6,
      );
      await modalApi.close();
      emit('success');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(open) {
    if (!open) {
      template.value = undefined;
      selectedAreaIds.value = [];
      requestId.value = '';
      resetPreview();
      return;
    }
    template.value = modalApi.getData<MallCouponTemplateApi.CouponTemplate>();
    requestId.value = createRequestId();
    selectedAreaIds.value = [];
    resetPreview();
    if (areaTree.value.length === 0) areaTree.value = await getAreaTree();
  },
});
</script>

<template>
  <Modal
    :title="`按收货地区发放 - ${template?.name || ''}`"
    class="!w-[85vw] max-w-[96vw]"
    :ok-text="`确认发放（已排除 ${excludedUserIds.size} 人）`"
  >
    <div class="flex h-[70vh] min-h-0 flex-col gap-3 overflow-hidden px-2 py-2">
      <Alert
        message="选择省或市会自动包含全部下级地区；会员任一未删除收货地址命中即可入选，同一会员只发一张券。"
        type="info"
        show-icon
      />
      <div class="flex items-center gap-3">
        <span class="shrink-0 font-medium">收货地区</span>
        <TreeSelect
          v-model:value="selectedAreaIds"
          class="min-w-0 flex-1"
          :tree-data="areaTree"
          :field-names="{ label: 'name', value: 'id', children: 'children' }"
          allow-clear
          tree-checkable
          :show-checked-strategy="TreeSelect.SHOW_PARENT"
          show-search
          placeholder="请选择省、市或区县，可多选"
          tree-node-filter-prop="name"
          @change="handleAreaChange"
        />
        <Button
          :disabled="!previewed || excludedUserIds.size === 0"
          @click="restoreAll"
        >
          恢复全部选择
        </Button>
      </div>
      <Descriptions bordered size="small" :column="4">
        <DescriptionsItem label="命中地址数">
          {{ addressMatchedCount }}
        </DescriptionsItem>
        <DescriptionsItem label="启用会员">
          {{ enabledMatchedCount }}
        </DescriptionsItem>
        <DescriptionsItem label="人工排除">
          {{ excludedUserIds.size }}
        </DescriptionsItem>
        <DescriptionsItem label="选择规则"
          >默认全选、跨页保留排除</DescriptionsItem
        >
      </Descriptions>
      <div class="min-h-0 flex-1 overflow-hidden">
        <Table
          :columns="columns"
          :data-source="rows"
          :loading="loading"
          :pagination="pagination"
          :row-key="(row: MallCouponApi.AddressTargetItem) => row.userId"
          :row-selection="rowSelection"
          :scroll="{ x: 900, y: 'calc(70vh - 260px)' }"
          bordered
          size="small"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'matchedAreaNames'">
              <Space :size="[4, 4]" wrap>
                <Tag
                  v-for="areaName in record.matchedAreaNames"
                  :key="areaName"
                >
                  {{ areaName }}
                </Tag>
              </Space>
            </template>
            <template v-else-if="column.dataIndex === 'sendable'">
              <Tag :color="record.sendable ? 'green' : 'orange'">
                {{ record.sendable ? '可发放' : record.skipReason }}
              </Tag>
            </template>
          </template>
        </Table>
      </div>
    </div>
  </Modal>
</template>
