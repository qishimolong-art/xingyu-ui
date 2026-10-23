<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpVoucherAttributionApi } from '#/api/erp/finance/accounting/voucher-attribution';

import { onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Card, Col, DatePicker, message, Row, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { searchSourceBiz } from '#/api/erp/finance/accounting/voucher-attribution';
import PreviewModal from '../voucher-rule/preview-modal.vue';
import ContextForm from '../voucher-rule/context-form.vue';
import { STATUS_LABELS } from '#/api/erp/finance/accounting/voucher-rule';
import { useFieldPermission } from '#/composables/useFieldPermission';

import {
  ATTRIBUTION_STATUS_COLOR,
  ATTRIBUTION_STATUS_MAP,
  useGridColumns,
  useGridFormSchema,
} from './data';

const FIELD_PERMISSION_MODULE = 'erp_accounting_voucher_attribution';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);

/** 归属设置区状态 */
const settingState = reactive({
  voucherMakeDate: undefined as string | undefined,
  attributionYM: undefined as string | undefined, // 'YYYY-MM'
});
const generating = ref(false);
const previewModal = ref<InstanceType<typeof PreviewModal>>();
const contextForm = ref<InstanceType<typeof ContextForm>>();
async function handleContext() {
  const rows = getCheckedRows();
  if (rows.length !== 1) {
    message.warning('请选择一笔单据补充记账信息');
    return;
  }
  const row = rows[0]!;
  if (row.bizType && row.bizId)
    await contextForm.value?.show(row.bizType, row.bizId);
}

function handleRefresh() {
  gridApi.query();
}

/** 取选中的行 */
function getCheckedRows(): ErpVoucherAttributionApi.VoucherAttribution[] {
  const records = gridApi.grid?.getCheckboxRecords?.() || [];
  return records as ErpVoucherAttributionApi.VoucherAttribution[];
}

function getAttributionStatus(status?: number) {
  return status ?? 10;
}

/** 统一预览后提交；制单日期留空时逐单使用业务日期。 */
async function handleGenerate() {
  const rows = getCheckedRows();
  if (!rows.length) {
    message.warning('请至少选择一笔单据');
    return;
  }
  const ym = settingState.attributionYM?.split('-').map(Number);
  if (
    ym &&
    (!settingState.voucherMakeDate ||
      settingState.voucherMakeDate.slice(0, 7) !== settingState.attributionYM)
  ) {
    message.warning('跨月归属时，制单日期须在所选月份内');
    return;
  }
  generating.value = true;
  try {
    await previewModal.value?.show(
      rows
        .filter((r) => r.bizType && r.bizId)
        .map((r) => ({
          bizType: r.bizType!,
          bizId: r.bizId!,
          voucherDate: settingState.voucherMakeDate,
          attributionYear: ym?.[0],
          attributionMonth: ym?.[1],
        })),
    );
  } finally {
    generating.value = false;
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(hiddenFields.value),
  },
  gridOptions: {
    columns: useGridColumns(hiddenFields.value),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const { bizDate, ...rest } = formValues || {};
          let bizDateStart: string | undefined;
          let bizDateEnd: string | undefined;
          if (Array.isArray(bizDate) && bizDate.length === 2) {
            bizDateStart = bizDate[0];
            bizDateEnd = bizDate[1];
          }
          const result = await searchSourceBiz({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            bizDateStart,
            bizDateEnd,
            ...rest,
          });
          return {
            ...result,
            list: result.list.map((row) => ({
              ...row,
              id: `${row.bizType}:${row.bizId}`,
            })),
          };
        },
      },
    },
    checkboxConfig: { reserve: true },
    rowConfig: {
      keyField: 'id',
      isHover: true,
      isCurrent: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpVoucherAttributionApi.VoucherAttribution>,
});

onMounted(async () => {
  await loadHiddenFields();
  gridApi.formApi?.setState?.({
    schema: useGridFormSchema(hiddenFields.value),
  });
  gridApi.setGridOptions({
    columns: useGridColumns(hiddenFields.value),
  });
});
</script>

<template>
  <Page auto-content-height>
    <PreviewModal ref="previewModal" @generated="handleRefresh" />
    <ContextForm ref="contextForm" @saved="handleRefresh" />
    <Card class="mb-3" title="归属设置区">
      <Row :gutter="16" align="middle">
        <Col :span="6">
          <span class="mr-2">制单日期</span>
          <DatePicker
            v-model:value="settingState.voucherMakeDate"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            placeholder="默认使用每笔单据业务日期"
            class="w-full"
          />
        </Col>
        <Col :span="6">
          <span class="mr-2">归属月份</span>
          <DatePicker
            v-model:value="settingState.attributionYM"
            picker="month"
            value-format="YYYY-MM"
            format="YYYY-MM"
            placeholder="业务归属月份"
            class="w-full"
          />
        </Col>
        <Col :span="12">
          <a-button
            type="primary"
            :loading="generating"
            v-access:code="['erp:voucher-attribution:generate']"
            class="mr-2"
            @click="handleGenerate"
          >
            预览并生成
          </a-button>
          <a-button
            v-access:code="['erp:voucher-attribution:generate']"
            class="mr-2"
            @click="handleContext"
            >补充记账信息</a-button
          >
          <span class="text-gray-400 text-xs">
            勾选单据 → 补充信息 → 预览 → 生成；日期留空时使用业务日期
          </span>
        </Col>
      </Row>
    </Card>

    <Grid table-title="待生成凭证单据列表">
      <template #generationStatus="{ row }"
        ><Tag>{{
          STATUS_LABELS[row.generationStatus || 'INCOMPLETE'] || '待补充'
        }}</Tag
        ><span>{{ row.generationIssues?.join('；') }}</span></template
      >
      <template #attributionStatus="{ row }">
        <Tag
          :color="
            ATTRIBUTION_STATUS_COLOR[
              getAttributionStatus(row.attributionStatus)
            ] || 'default'
          "
        >
          {{
            ATTRIBUTION_STATUS_MAP[
              getAttributionStatus(row.attributionStatus)
            ] || '未归属'
          }}
        </Tag>
      </template>
    </Grid>
  </Page>
</template>
