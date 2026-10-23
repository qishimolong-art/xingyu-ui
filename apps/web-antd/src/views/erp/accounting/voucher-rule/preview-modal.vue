<script setup lang="ts">
import { computed, ref } from 'vue';
import { Alert, Checkbox, message, Modal, Table, Tag } from 'ant-design-vue';
import type {
  GenerationRequest,
  Preview,
} from '#/api/erp/finance/accounting/voucher-rule';
import {
  generatePreview,
  previewVouchers,
  STATUS_LABELS,
} from '#/api/erp/finance/accounting/voucher-rule';
import AuxiliaryEditor from './auxiliary-editor.vue';
import GenerationEvidence from './generation-evidence.vue';
const emit = defineEmits(['generated']);
const open = ref(false);
const busy = ref(false);
const rows = ref<Preview[]>([]);
const selected = ref<string[]>([]);
const detail = ref<Preview>();
const requests = ref<GenerationRequest[]>([]);
const key = (p: { bizType?: number; bizId?: number }) =>
  `${p.bizType}:${p.bizId}`;
const allReady = computed(() =>
  rows.value.filter((p) => p.status === 'READY').map(key),
);
async function show(items: GenerationRequest[]) {
  busy.value = true;
  try {
    requests.value = items;
    rows.value = await previewVouchers(items);
    selected.value = allReady.value;
    detail.value = rows.value[0];
    open.value = true;
  } finally {
    busy.value = false;
  }
}
async function generate() {
  const chosen = rows.value.filter(
    (p) => selected.value.includes(key(p)) && p.status === 'READY',
  );
  if (!chosen.length) {
    message.warning('请选择可生成的单据');
    return;
  }
  busy.value = true;
  try {
    await generatePreview(
      chosen.map((p) => ({
        ...requests.value.find(
          (r) => r.bizType === p.bizType && r.bizId === p.bizId,
        )!,
        voucherDate: p.voucherDate,
        previewToken: p.previewToken,
      })),
    );
    message.success('已生成未审核凭证');
    open.value = false;
    emit('generated');
  } finally {
    busy.value = false;
  }
}
defineExpose({ show });
</script>
<template>
  <Modal
    v-model:open="open"
    title="凭证生成预览"
    class="!w-[85vw]"
    :confirm-loading="busy"
    :ok-text="`生成（已选 ${selected.length} 笔）`"
    @ok="generate"
  >
    <div class="h-[70vh] overflow-auto">
      <Alert
        class="mb-3"
        message="仅可生成的单据可勾选。来源、规则或辅助核算变化后，需要重新预览。"
      />
      <Checkbox
        :checked="selected.length === allReady.length && allReady.length > 0"
        @change="(e) => (selected = e.target.checked ? [...allReady] : [])"
        >全选可生成单据</Checkbox
      >
      <Table
        class="my-3"
        :data-source="rows"
        :row-key="key"
        :pagination="{ pageSize: 10 }"
        :scroll="{ x: 1000, y: 220 }"
        :custom-row="(record) => ({ onClick: () => (detail = record) })"
        :columns="[
          { title: '选择', key: 'select', width: 60 },
          { title: '单号', dataIndex: 'bizNo' },
          { title: '状态', key: 'status' },
          { title: '制单日期', dataIndex: 'voucherDate' },
          { title: '来源金额', dataIndex: 'sourceAmount' },
          { title: '问题', key: 'issues' },
        ]"
      >
        <template #bodyCell="{ column, record }">
          <Checkbox
            v-if="column.key === 'select'"
            :disabled="record.status !== 'READY'"
            :checked="selected.includes(key(record))"
            @change="
              (e) =>
                (selected = e.target.checked
                  ? [...selected, key(record)]
                  : selected.filter((k) => k !== key(record)))
            "
          />
          <Tag
            v-else-if="column.key === 'status'"
            :color="record.status === 'READY' ? 'green' : 'default'"
            >{{ STATUS_LABELS[record.status] }}</Tag
          >
          <span v-else-if="column.key === 'issues'">{{
            record.issues.join('；')
          }}</span>
        </template>
      </Table>
      <template v-if="detail">
        <p class="mb-2 font-medium">
          {{ detail.bizNo }} · 规则 {{ detail.scenario || '未选择' }} · 配置版本
          {{ detail.configVersion }} · 库存流水
          {{ detail.stockAmount ?? '不涉及' }}
        </p>
        <Table
          :data-source="detail.items"
          :pagination="false"
          :scroll="{ x: 1000, y: 240 }"
          :columns="[
            { title: '金额来源/摘要', dataIndex: 'summary' },
            { title: '科目编码', dataIndex: 'subjectCode' },
            { title: '科目名称', dataIndex: 'subjectName' },
            { title: '借方', dataIndex: 'debitAmount' },
            { title: '贷方', dataIndex: 'creditAmount' },
            { title: '辅助核算', key: 'aux' },
          ]"
        >
          <template #bodyCell="{ column, record }"
            ><AuxiliaryEditor
              v-if="column.key === 'aux'"
              :model-value="record.auxiliaries"
              :legacy-name="record.auxiliaryName"
              disabled
          /></template>
        </Table>
        <details class="mt-3">
          <summary>查看金额与来源依据</summary>
          <GenerationEvidence :evidence="detail.evidence" />
        </details>
      </template>
    </div>
  </Modal>
</template>
