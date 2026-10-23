<script lang="ts" setup>
import type { ErpSearchFieldConfigApi } from '#/api/erp/config/search';

import { computed, onMounted, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';

import {
  ElButton,
  ElCard,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import {
  batchUpdateSearchFieldConfig,
  getSearchFieldConfigList,
  getSearchFieldConfigModules,
  resetSearchFieldConfig,
} from '#/api/erp/config/search';
import { clearErpSearchFieldConfigCache } from '#/views/erp/composables/useErpSearchFieldConfig';

defineOptions({ name: 'ErpSearchFieldConfig' });

type Row = ErpSearchFieldConfigApi.SearchFieldConfig & {
  enabled: boolean;
  sort: number;
};

const modules = ref<ErpSearchFieldConfigApi.Module[]>([]);
const moduleKey = ref('');
const rows = ref<Row[]>([]);
const loading = ref(false);
const saving = ref(false);

const moduleName = computed(() => {
  return modules.value.find((item) => item.key === moduleKey.value)?.name || '';
});

async function loadModules() {
  modules.value = await getSearchFieldConfigModules();
  if (!moduleKey.value && modules.value.length > 0) {
    moduleKey.value = modules.value[0]!.key;
  }
}

async function loadConfig() {
  if (!moduleKey.value) {
    rows.value = [];
    return;
  }

  loading.value = true;
  try {
    const list = await getSearchFieldConfigList(moduleKey.value);
    rows.value = list.map((item, index) => ({
      ...item,
      enabled: item.enabled !== false,
      sort: item.sort ?? index + 1,
    }));
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (!moduleKey.value) {
    return;
  }

  saving.value = true;
  try {
    await batchUpdateSearchFieldConfig({
      moduleKey: moduleKey.value,
      items: rows.value.map((item, index) => ({
        component: item.component,
        enabled: item.enabled,
        fieldLabel: item.fieldLabel,
        fieldName: item.fieldName,
        sort: item.sort ?? index + 1,
      })),
    });
    clearErpSearchFieldConfigCache(moduleKey.value);
    ElMessage.success('保存成功');
  } finally {
    saving.value = false;
  }
}

async function handleReset() {
  if (!moduleKey.value) {
    return;
  }

  await resetSearchFieldConfig(moduleKey.value);
  clearErpSearchFieldConfigCache(moduleKey.value);
  await loadConfig();
  ElMessage.success('已重置');
}

watch(moduleKey, loadConfig);

onMounted(async () => {
  await loadModules();
});
</script>

<template>
  <Page auto-content-height>
    <ElCard shadow="never">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <span class="text-sm text-muted-foreground">模块</span>
          <ElSelect
            v-model="moduleKey"
            class="w-64"
            filterable
            placeholder="请选择模块"
          >
            <ElOption
              v-for="item in modules"
              :key="item.key"
              :label="item.name"
              :value="item.key"
            />
          </ElSelect>
          <span class="text-sm text-muted-foreground">{{ moduleName }}</span>
        </div>
        <div class="flex gap-2">
          <ElButton :disabled="!moduleKey" @click="handleReset">重置</ElButton>
          <ElButton
            type="primary"
            :loading="saving"
            :disabled="!moduleKey"
            @click="handleSave"
          >
            保存
          </ElButton>
        </div>
      </div>

      <ElTable
        v-loading="loading"
        :data="rows"
        border
        height="calc(100vh - 260px)"
      >
        <ElTableColumn prop="fieldName" label="字段名" min-width="160" />
        <ElTableColumn label="字段标题" min-width="180">
          <template #default="{ row }">
            <ElInput v-model="row.fieldLabel" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="组件" min-width="150">
          <template #default="{ row }">
            <ElInput v-model="row.component" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="启用" width="90" align="center">
          <template #default="{ row }">
            <ElSwitch v-model="row.enabled" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="排序" width="120" align="center">
          <template #default="{ row }">
            <ElInputNumber
              v-model="row.sort"
              :min="0"
              :precision="0"
              controls-position="right"
              class="w-full"
            />
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>
  </Page>
</template>
