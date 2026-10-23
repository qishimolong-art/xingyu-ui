<script lang="ts" setup>
import type { ErpReportItemTemplateApi } from '#/api/erp/finance/accounting/report-template';

import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Card,
  Checkbox,
  Col,
  DatePicker,
  message,
  Row,
  Table,
} from 'ant-design-vue';

import { getReportItemTemplateList } from '#/api/erp/finance/accounting/report-template';
import { getCurrentLocalMonth } from '#/views/erp/utils/form-defaults';

const filterMonth = ref<string>(getCurrentLocalMonth());
const company = ref<string>('-');
const includeChainTransfer = ref(false);
const loading = ref(false);
const rows = ref<ErpReportItemTemplateApi.ReportItemTemplate[]>([]);

const columns = [
  { title: '项目', dataIndex: 'itemName', width: '40%' },
  { title: '行次', dataIndex: 'rowNo', width: '12%', align: 'center' },
  {
    title: '本月数',
    dataIndex: 'monthAmount',
    width: '24%',
    align: 'right',
    customRender: () => '不可用',
  },
  {
    title: '本年累计',
    dataIndex: 'yearAmount',
    width: '24%',
    align: 'right',
    customRender: () => '不可用',
  },
];

async function loadData() {
  loading.value = true;
  try {
    rows.value = (await getReportItemTemplateList(2, 1)) || [];
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  loadData();
}

function handleExport() {
  message.info('导出功能将在后续版本实现（公式取数完成后）');
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <Page auto-content-height>
    <Alert
      type="info"
      show-icon
      message="利润表（骨架页）"
      description="本页面为骨架版本：报表项目模板已就绪，但取数公式尚未配置，金额列显示“不可用”。正式输出需按已确认公式和凭证取数，并处理退货红冲、总部代付、内部抵销和期间锁定；未确认公式时禁止作为正式报表。"
      class="mb-3"
    />

    <Card class="mb-3">
      <Row :gutter="16" align="middle">
        <Col :span="6">
          <span class="mr-2">日期</span>
          <DatePicker
            v-model:value="filterMonth"
            picker="month"
            value-format="YYYY-MM"
            format="YYYY-MM"
            class="w-full"
          />
        </Col>
        <Col :span="6">
          <span class="mr-2">编制单位</span>
          <a-input v-model:value="company" disabled class="w-full" />
        </Col>
        <Col :span="6">
          <Checkbox v-model:checked="includeChainTransfer">
            包含连锁调拨利润
          </Checkbox>
        </Col>
        <Col :span="6">
          <a-button type="primary" class="mr-2" @click="handleQuery">
            查询
          </a-button>
          <a-button @click="handleExport">导出 Excel</a-button>
        </Col>
      </Row>
    </Card>

    <Card title="利润表" size="small">
      <Table
        :data-source="rows"
        :columns="columns as any"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="small"
        bordered
      />
    </Card>
  </Page>
</template>
