<script lang="ts" setup>
import type { ErpReportItemTemplateApi } from '#/api/erp/finance/accounting/report-template';

import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Card,
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
const loading = ref(false);
const leftRows = ref<ErpReportItemTemplateApi.ReportItemTemplate[]>([]);
const rightRows = ref<ErpReportItemTemplateApi.ReportItemTemplate[]>([]);

const leftColumns = [
  { title: '项目', dataIndex: 'itemName', width: '60%' },
  { title: '行次', dataIndex: 'rowNo', width: '15%', align: 'center' },
  {
    title: '本期金额',
    dataIndex: 'currentAmount',
    width: '25%',
    align: 'right',
    customRender: () => '不可用',
  },
];

const rightColumns = [
  { title: '补充资料', dataIndex: 'itemName', width: '60%' },
  { title: '行次', dataIndex: 'rowNo', width: '15%', align: 'center' },
  {
    title: '本期金额',
    dataIndex: 'currentAmount',
    width: '25%',
    align: 'right',
    customRender: () => '不可用',
  },
];

async function loadData() {
  loading.value = true;
  try {
    const [left, right] = await Promise.all([
      getReportItemTemplateList(3, 1),
      getReportItemTemplateList(3, 2),
    ]);
    leftRows.value = left || [];
    rightRows.value = right || [];
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
      message="现金流量表（骨架页）"
      description="本页面为骨架版本：报表项目模板已就绪，但取数公式尚未配置，金额列显示“不可用”。正式输出需先完成现金流项目归集、凭证取数和逐级下钻；未确认公式和现金流项目时禁止作为正式报表。"
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
        <Col :span="12">
          <a-button type="primary" class="mr-2" @click="handleQuery">
            查询
          </a-button>
          <a-button @click="handleExport">导出 Excel</a-button>
        </Col>
      </Row>
    </Card>

    <Row :gutter="16">
      <Col :span="12">
        <Card title="主表（直接法）" size="small">
          <Table
            :data-source="leftRows"
            :columns="leftColumns as any"
            :loading="loading"
            :pagination="false"
            row-key="id"
            size="small"
            bordered
          />
        </Card>
      </Col>
      <Col :span="12">
        <Card title="补充资料（间接法）" size="small">
          <Table
            :data-source="rightRows"
            :columns="rightColumns as any"
            :loading="loading"
            :pagination="false"
            row-key="id"
            size="small"
            bordered
          />
        </Card>
      </Col>
    </Row>
  </Page>
</template>
