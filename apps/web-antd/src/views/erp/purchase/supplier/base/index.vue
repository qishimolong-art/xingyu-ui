<script lang="ts" setup>
import type { ErpSupplierApi } from '#/api/erp/purchase/supplier';

import { computed, onMounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';

import { Button, Descriptions, Empty, Select, Tag } from 'ant-design-vue';

import { getSupplierSimpleList } from '#/api/erp/purchase/supplier';
import { filterErpBusinessPartnerOption } from '#/views/erp/utils/business-partner-select';

import SupplierDetail from '../modules/detail.vue';

/** ERP 供应商基础表 */
defineOptions({ name: 'ErpSupplierBase' });

interface SupplierOption {
  label: string;
  value: number;
}

const suppliers = ref<ErpSupplierApi.Supplier[]>([]);
const selectedSupplierId = ref<number>();

const supplierOptions = computed<SupplierOption[]>(() =>
  suppliers.value
    .filter((item) => item.id)
    .map((item) => {
      const code = item.code ? `${item.code} - ` : '';
      return {
        ...item,
        label: `${code}${item.name}`,
        value: item.id!,
      };
    }),
);

const selectedSupplier = computed(() =>
  suppliers.value.find((item) => item.id === selectedSupplierId.value),
);

const [DetailModal, detailModalApi] = useVbenModal({
  connectedComponent: SupplierDetail,
  destroyOnClose: true,
});

function valueOrDash(value?: number | string) {
  return value || '-';
}

function handleOpenDetail() {
  if (!selectedSupplier.value) return;
  detailModalApi.setData(selectedSupplier.value).open();
}

onMounted(async () => {
  suppliers.value = await getSupplierSimpleList();
});
</script>

<template>
  <Page auto-content-height>
    <DetailModal />

    <div class="supplier-base-page">
      <div class="supplier-base-toolbar">
        <div>
          <div class="supplier-base-title">供应商基础表</div>
          <div class="supplier-base-subtitle">
            选择供应商后，集中维护联系人、合同、账户、票据、任务量和工商信息等基础资料。
          </div>
        </div>

        <div class="supplier-base-actions">
          <Select
            v-model:value="selectedSupplierId"
            allow-clear
            class="supplier-base-select"
            :filter-option="filterErpBusinessPartnerOption"
            :options="supplierOptions"
            placeholder="请选择供应商"
            show-search
          />
          <Button
            :disabled="!selectedSupplier"
            type="primary"
            @click="handleOpenDetail"
          >
            管理基础表
          </Button>
        </div>
      </div>

      <div v-if="selectedSupplier" class="supplier-base-summary">
        <Descriptions
          bordered
          size="small"
          :column="{ lg: 3, md: 2, sm: 1, xs: 1 }"
        >
          <Descriptions.Item label="供应商编码">
            {{ valueOrDash(selectedSupplier.code) }}
          </Descriptions.Item>
          <Descriptions.Item label="供应商名称">
            {{ valueOrDash(selectedSupplier.name) }}
          </Descriptions.Item>
          <Descriptions.Item label="联系人">
            {{ valueOrDash(selectedSupplier.contact) }}
          </Descriptions.Item>
          <Descriptions.Item label="手机号码">
            {{ valueOrDash(selectedSupplier.mobile) }}
          </Descriptions.Item>
          <Descriptions.Item label="联系电话">
            {{ valueOrDash(selectedSupplier.telephone) }}
          </Descriptions.Item>
          <Descriptions.Item label="结算方式">
            {{ valueOrDash(selectedSupplier.settleMethod) }}
          </Descriptions.Item>
          <Descriptions.Item label="区域">
            {{ valueOrDash(selectedSupplier.region) }}
          </Descriptions.Item>
          <Descriptions.Item label="供应商类型">
            {{ valueOrDash(selectedSupplier.supplierType) }}
          </Descriptions.Item>
          <Descriptions.Item label="地址">
            {{ valueOrDash(selectedSupplier.address) }}
          </Descriptions.Item>
        </Descriptions>

        <div class="supplier-base-tabs">
          <Tag color="blue">联系人</Tag>
          <Tag color="cyan">合同</Tag>
          <Tag color="green">拓展配置</Tag>
          <Tag color="geekblue">动态字段</Tag>
          <Tag color="gold">企业信息</Tag>
          <Tag color="purple">供应商账户</Tag>
          <Tag color="orange">票据登记</Tag>
          <Tag color="volcano">任务量</Tag>
          <Tag color="magenta">工商信息</Tag>
        </div>
      </div>

      <Empty
        v-else
        class="supplier-base-empty"
        description="请选择一个供应商开始维护基础表"
      />
    </div>
  </Page>
</template>

<style scoped>
.supplier-base-page {
  min-height: calc(100vh - 160px);
  padding: 20px;
  background: hsl(var(--background));
}

.supplier-base-toolbar {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px;
  margin-bottom: 16px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.supplier-base-title {
  font-size: 18px;
  font-weight: 600;
  line-height: 28px;
  color: hsl(var(--foreground));
}

.supplier-base-subtitle {
  max-width: 680px;
  margin-top: 4px;
  font-size: 13px;
  line-height: 22px;
  color: hsl(var(--muted-foreground));
}

.supplier-base-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.supplier-base-select {
  width: min(360px, 68vw);
}

.supplier-base-summary {
  padding: 20px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.supplier-base-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 16px;
}

.supplier-base-empty {
  padding-top: 80px;
}

@media (max-width: 768px) {
  .supplier-base-toolbar {
    flex-direction: column;
  }

  .supplier-base-actions {
    justify-content: flex-start;
    width: 100%;
  }

  .supplier-base-select {
    width: 100%;
  }
}
</style>
