<script lang="ts" setup>
import type { SystemDeptApi } from '#/api/system/dept';

import { computed, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { handleTree } from '@vben/utils';

import {
  Alert,
  Button,
  Form,
  FormItem,
  message,
  Skeleton,
  TreeSelect,
} from 'ant-design-vue';

import {
  getAutoWriteOffConfig,
  updateAutoWriteOffConfig,
} from '#/api/erp/config/auto-write-off';
import { getSimpleDeptList } from '#/api/system/dept';

defineOptions({ name: 'ErpAutoWriteOffConfig' });

const { hasAccessByCodes } = useAccess();

const loading = ref(false);
const saving = ref(false);
const deptTreeData = ref<SystemDeptApi.Dept[]>([]);
const disabledDeptIds = ref<number[]>([]);
const effectiveDisabledDeptIds = ref<number[]>([]);

const canSave = computed(() =>
  hasAccessByCodes(['erp:auto-write-off-config:update']),
);

const selectedDeptCount = computed(() => disabledDeptIds.value.length);
const effectiveDeptCount = computed(
  () => effectiveDisabledDeptIds.value.length,
);

const text = {
  disabledDept: '关闭自动核销部门',
  emptyDept: '未选择所属部门的收款单、付款单默认不会自动核销。',
  info: '选择的部门及其下级部门不会在收/付款审批后自动核销，人工核销、审批前已选明细转有效、反核销不受影响。',
  placeholderDept: '请选择需要关闭自动核销的部门',
  save: '保存',
  saveSuccess: '自动核销配置已保存',
  summary: '已配置 {selected} 个部门，实际影响 {effective} 个部门',
  title: '自动核销配置',
};

function filterEnabledDepartments(
  depts: SystemDeptApi.Dept[],
): SystemDeptApi.Dept[] {
  return depts
    .filter((dept) => dept.status === undefined || dept.status === 0)
    .map((dept) => ({
      ...dept,
      children: filterEnabledDepartments(
        (dept.children || []) as SystemDeptApi.Dept[],
      ),
    }));
}

async function loadDeptTree() {
  if (deptTreeData.value.length > 0) {
    return;
  }
  const depts = await getSimpleDeptList();
  deptTreeData.value = handleTree(
    filterEnabledDepartments(depts),
  ) as SystemDeptApi.Dept[];
}

async function loadConfig() {
  loading.value = true;
  try {
    await loadDeptTree();
    const config = await getAutoWriteOffConfig();
    disabledDeptIds.value = config.disabledDeptIds || [];
    effectiveDisabledDeptIds.value = config.effectiveDisabledDeptIds || [];
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  saving.value = true;
  try {
    await updateAutoWriteOffConfig({
      disabledDeptIds: disabledDeptIds.value,
    });
    message.success(text.saveSuccess);
    await loadConfig();
  } finally {
    saving.value = false;
  }
}

onMounted(loadConfig);
</script>

<template>
  <Page :title="text.title">
    <div class="mx-auto max-w-[820px]">
      <Alert class="mb-4" show-icon type="info" :message="text.info" />

      <div class="rounded border border-gray-200 bg-white p-6">
        <Skeleton :loading="loading" active>
          <Form :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
            <FormItem :label="text.disabledDept">
              <TreeSelect
                v-model:value="disabledDeptIds"
                allow-clear
                class="w-full"
                multiple
                :placeholder="text.placeholderDept"
                show-search
                tree-checkable
                tree-node-filter-prop="name"
                :field-names="{
                  label: 'name',
                  value: 'id',
                  children: 'children',
                }"
                :tree-data="deptTreeData"
              />
              <div class="auto-write-off-config__help">
                {{
                  text.summary
                    .replace('{selected}', String(selectedDeptCount))
                    .replace('{effective}', String(effectiveDeptCount))
                }}
              </div>
              <div class="auto-write-off-config__help">
                {{ text.emptyDept }}
              </div>
            </FormItem>
            <FormItem :wrapper-col="{ offset: 6, span: 16 }">
              <Button
                v-access:code="['erp:auto-write-off-config:update']"
                type="primary"
                :disabled="!canSave"
                :loading="saving"
                @click="handleSubmit"
              >
                {{ text.save }}
              </Button>
            </FormItem>
          </Form>
        </Skeleton>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.auto-write-off-config__help {
  margin-top: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.6;
}
</style>
