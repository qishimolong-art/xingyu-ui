<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type { ErpStockSelectPriceConfigApi } from '#/api/erp/config/stock-select-price';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Input,
  message,
  Modal,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  getStockSelectPriceConfig,
  updateStockSelectPriceConfig,
} from '#/api/erp/config/stock-select-price';

defineOptions({ name: 'ErpStockSelectPriceConfig' });

type FieldRow = ErpStockSelectPriceConfigApi.Field;

const { hasAccessByCodes } = useAccess();
const loading = ref(false);
const saving = ref(false);
const keyword = ref('');
const configVersion = ref('');
const fields = ref<FieldRow[]>([]);
const originalValues = ref<Record<string, string>>({});
const selectedRowKeys = ref<string[]>([]);

const canUpdate = computed(() =>
  hasAccessByCodes(['erp:stock-select-price-config:update']),
);
const dirtyFieldKeys = computed(() =>
  fields.value
    .filter(
      (field) => snapshotValue(field) !== originalValues.value[field.fieldKey],
    )
    .map((field) => field.fieldKey),
);
const dirty = computed(() => dirtyFieldKeys.value.length > 0);
const visibleFields = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase();
  if (!query) return fields.value;
  return fields.value.filter(
    (field) =>
      field.fieldLabel.toLocaleLowerCase().includes(query) ||
      field.fieldKey.toLocaleLowerCase().includes(query),
  );
});
const summary = computed(() => ({
  purchase: fields.value.filter((field) => field.purchaseVisible).length,
  sale: fields.value.filter((field) => field.saleVisible).length,
  total: fields.value.length,
}));
const rowSelection = computed(() => ({
  onChange: (keys: (number | string)[]) => {
    selectedRowKeys.value = keys.map(String);
  },
  selectedRowKeys: selectedRowKeys.value,
}));
const columns: TableColumnsType = [
  { key: 'index', title: '序号', width: 70 },
  { key: 'field', title: '价格名称', width: 220 },
  { dataIndex: 'fieldKey', key: 'fieldKey', title: '字段编码', width: 220 },
  { key: 'source', title: '类型', width: 120 },
  { key: 'sale', title: '销售选择库存', width: 170 },
  { key: 'purchase', title: '采购选择库存', width: 170 },
  { key: 'constraint', title: '权限约束', width: 250 },
  { key: 'state', title: '状态', width: 130 },
];

function snapshotValue(field: FieldRow) {
  return `${Number(field.saleVisible)}:${Number(field.purchaseVisible)}`;
}

function snapshotFields() {
  originalValues.value = Object.fromEntries(
    fields.value.map((field) => [field.fieldKey, snapshotValue(field)]),
  );
}

function stateMeta(field: FieldRow | Record<string, any>) {
  if (field.saleVisible && field.purchaseVisible)
    return { color: 'green', text: '双场景' };
  if (field.saleVisible) return { color: 'blue', text: '仅销售' };
  if (field.purchaseVisible) return { color: 'orange', text: '仅采购' };
  return { color: 'default', text: '均隐藏' };
}

async function loadConfig(force = false) {
  if (dirty.value && !force) {
    Modal.confirm({
      content: '刷新会丢失当前未保存的修改。',
      okText: '继续刷新',
      title: '确认刷新配置？',
      onOk: () => loadConfig(true),
    });
    return;
  }
  loading.value = true;
  try {
    const config = await getStockSelectPriceConfig();
    configVersion.value = config.configVersion;
    fields.value = config.fields || [];
    snapshotFields();
    selectedRowKeys.value = [];
  } finally {
    loading.value = false;
  }
}

function resetChanges() {
  fields.value.forEach((field) => {
    const [sale, purchase] = (
      originalValues.value[field.fieldKey] || '0:0'
    ).split(':');
    field.saleVisible = sale === '1';
    field.purchaseVisible = purchase === '1';
  });
  message.success('已重置未保存修改');
}

function setSelectedVisible(
  scene: 'purchaseVisible' | 'saleVisible',
  visible: boolean,
) {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先勾选需要批量设置的价格字段');
    return;
  }
  const selected = new Set(selectedRowKeys.value);
  fields.value.forEach((field) => {
    if (selected.has(field.fieldKey)) field[scene] = visible;
  });
}

async function saveConfig() {
  if (!dirty.value) {
    message.info('当前没有需要保存的修改');
    return;
  }
  saving.value = true;
  try {
    const dirtyKeys = new Set(dirtyFieldKeys.value);
    await updateStockSelectPriceConfig({
      configVersion: configVersion.value,
      items: fields.value
        .filter((field) => dirtyKeys.has(field.fieldKey))
        .map((field) => ({
          fieldKey: field.fieldKey,
          purchaseVisible: field.purchaseVisible,
          saleVisible: field.saleVisible,
        })),
    });
    message.success('价格名称配置已保存，下次打开库存选择弹窗时生效');
    await loadConfig(true);
  } finally {
    saving.value = false;
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return;
  event.preventDefault();
  event.returnValue = '';
}

onBeforeRouteLeave(() => {
  if (!dirty.value) return true;
  return window.confirm('存在未保存的价格名称配置，确认离开当前页面？');
});

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
  void loadConfig(true);
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
});
</script>

<template>
  <Page title="价格名称管理">
    <div class="price-name-page">
      <Alert
        class="mb-4"
        show-icon
        type="info"
        message="本页只设置销售、采购在“选择库存”时允许出现的价格列。最终可见范围仍与“配件价格查看权限”取交集，本页不能重新放开已被角色、部门或个人权限隐藏的价格。"
      />

      <div class="overview mb-4">
        <div>
          <div class="overview-title">库存选择价格目录</div>
          <div class="overview-copy">
            价格名称同步自配件字段配置，此处只维护场景开关
          </div>
        </div>
        <div class="metrics">
          <div class="metric">
            <strong>{{ summary.total }}</strong
            ><span>价格总数</span>
          </div>
          <div class="metric sale">
            <strong>{{ summary.sale }}</strong
            ><span>销售已启用</span>
          </div>
          <div class="metric purchase">
            <strong>{{ summary.purchase }}</strong
            ><span>采购已启用</span>
          </div>
        </div>
      </div>

      <Card :bordered="false" class="config-card">
        <div class="toolbar">
          <div class="toolbar-group">
            <Input
              v-model:value="keyword"
              allow-clear
              class="w-[300px]"
              placeholder="搜索价格名称或字段编码"
            />
            <Button :loading="loading" @click="loadConfig(false)">刷新</Button>
          </div>
          <div class="toolbar-group">
            <span v-if="dirty" class="dirty-tip"
              >{{ dirtyFieldKeys.length }} 项未保存</span
            >
            <Button :disabled="!dirty" @click="resetChanges">重置</Button>
            <Button
              v-access:code="['erp:stock-select-price-config:update']"
              type="primary"
              :disabled="!canUpdate || !dirty"
              :loading="saving"
              @click="saveConfig"
            >
              保存修改
            </Button>
          </div>
        </div>

        <div v-if="canUpdate" class="batch-strip">
          <span class="batch-label"
            >批量设置（已选 {{ selectedRowKeys.length }} 项）</span
          >
          <Button @click="setSelectedVisible('saleVisible', true)"
            >销售开启</Button
          >
          <Button @click="setSelectedVisible('saleVisible', false)"
            >销售关闭</Button
          >
          <Button @click="setSelectedVisible('purchaseVisible', true)"
            >采购开启</Button
          >
          <Button @click="setSelectedVisible('purchaseVisible', false)"
            >采购关闭</Button
          >
        </div>

        <Table
          :columns="columns"
          :data-source="visibleFields"
          :loading="loading"
          :pagination="false"
          row-key="fieldKey"
          :row-selection="rowSelection"
          :scroll="{ x: 'max-content', y: 'calc(100vh - 400px)' }"
          size="middle"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'index'">{{ index + 1 }}</template>
            <template v-else-if="column.key === 'field'">
              <div class="field-name">{{ record.fieldLabel }}</div>
              <span
                v-if="dirtyFieldKeys.includes(record.fieldKey)"
                class="changed-mark"
                >已修改</span
              >
            </template>
            <template v-else-if="column.key === 'fieldKey'">
              <code class="field-code">{{ record.fieldKey }}</code>
            </template>
            <template v-else-if="column.key === 'source'">
              <Tag :color="record.fieldSource === 'CUSTOM' ? 'purple' : 'blue'">
                {{
                  record.fieldSource === 'CUSTOM' ? '自定义价格' : '系统价格'
                }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'sale'">
              <Switch
                v-model:checked="record.saleVisible"
                :disabled="!canUpdate"
                checked-children="显示"
                un-checked-children="隐藏"
              />
            </template>
            <template v-else-if="column.key === 'purchase'">
              <Switch
                v-model:checked="record.purchaseVisible"
                :disabled="!canUpdate"
                checked-children="显示"
                un-checked-children="隐藏"
              />
            </template>
            <template v-else-if="column.key === 'constraint'">
              <span class="constraint-copy">仍受配件价格查看权限约束</span>
            </template>
            <template v-else-if="column.key === 'state'">
              <Tag :color="stateMeta(record).color">{{
                stateMeta(record).text
              }}</Tag>
            </template>
          </template>
        </Table>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.price-name-page {
  --ink: #172033;
  --muted: #667085;
  --line: #e4e7ec;
}
.overview {
  display: flex;
  min-height: 88px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 22px;
  border: 1px solid #dbe2ee;
  border-left: 4px solid #244c8f;
  border-radius: 8px;
  background: #fff;
}
.overview-title {
  color: var(--ink);
  font-size: 17px;
  font-weight: 650;
}
.overview-copy {
  margin-top: 5px;
  color: var(--muted);
  font-size: 12px;
}
.metrics {
  display: grid;
  min-width: 480px;
  grid-template-columns: repeat(3, 1fr);
}
.metric {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  border-left: 1px solid var(--line);
}
.metric strong {
  color: var(--ink);
  font-size: 25px;
}
.metric span {
  color: var(--muted);
  font-size: 12px;
}
.metric.sale strong {
  color: #1d4ed8;
}
.metric.purchase strong {
  color: #15803d;
}
.config-card :deep(.ant-card-body) {
  padding: 0;
}
.toolbar,
.batch-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
}
.toolbar-group,
.batch-strip {
  display: flex;
  align-items: center;
  gap: 10px;
}
.batch-strip {
  justify-content: flex-start;
  background: #f8fafc;
}
.batch-label {
  margin-right: 4px;
  color: #344054;
  font-weight: 600;
}
.dirty-tip,
.changed-mark {
  color: #b45309;
  font-size: 12px;
}
.field-name {
  color: var(--ink);
  font-weight: 600;
}
.field-code {
  padding: 2px 6px;
  border-radius: 4px;
  background: #f2f4f7;
  color: #475467;
}
.constraint-copy {
  color: #667085;
}
@media (max-width: 900px) {
  .overview,
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .metrics {
    min-width: 0;
  }
}
</style>
