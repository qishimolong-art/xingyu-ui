<script lang="ts" setup>
import type { ErpSaleCartApi } from '#/api/erp/sale/cart';
import type { SystemDeptApi } from '#/api/system/dept';

import { computed, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { handleTree } from '@vben/utils';

import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormItem,
  message,
  Skeleton,
  Switch,
  TreeSelect,
} from 'ant-design-vue';

import {
  getSaleCartFirstApproveConfig,
  updateSaleCartFirstApproveConfig,
} from '#/api/erp/sale/cart';
import { getSimpleDeptList } from '#/api/system/dept';

defineOptions({ name: 'ErpSaleCartFirstApproveConfig' });

const { hasAccessByCodes } = useAccess();

const loading = ref(false);
const saving = ref(false);
const deptTreeData = ref<SystemDeptApi.Dept[]>([]);
const formData = ref<ErpSaleCartApi.FirstApproveConfigSave>({
  enabled: true,
  deptAuthEnabled: false,
  includeChildDept: true,
  deptIds: [],
});

const canSave = computed(() =>
  hasAccessByCodes(['erp:sale-cart:first-approve-config']),
);

const text = {
  authDept: '\u6388\u6743\u90e8\u95e8',
  childDept: '\u5305\u542b\u5b50\u90e8\u95e8',
  childDeptTip:
    '\u6388\u6743\u90e8\u95e8\u7684\u5b50\u90e8\u95e8\u4e5f\u53ef\u521d\u5ba1',
  deptAuth: '\u90e8\u95e8\u6388\u6743',
  enableFirstApprove: '\u542f\u7528\u521d\u5ba1',
  info: '\u5173\u95ed\u521d\u5ba1\u540e\uff0c\u9500\u552e\u624b\u63a8\u8f66\u63d0\u4ea4\u540e\u4f1a\u76f4\u63a5\u8fdb\u5165\u7ec8\u5ba1\uff1b\u5f00\u542f\u90e8\u95e8\u6388\u6743\u540e\uff0c\u4ec5\u6388\u6743\u90e8\u95e8\u7528\u6237\u53ef\u6267\u884c\u521d\u5ba1\u3002',
  placeholderDept: '\u8bf7\u9009\u62e9\u6388\u6743\u90e8\u95e8',
  save: '\u4fdd\u5b58',
  saveSuccess: '\u521d\u5ba1\u8bbe\u7f6e\u5df2\u4fdd\u5b58',
  title: '\u9500\u552e\u624b\u63a8\u8f66\u521d\u5ba1\u8bbe\u7f6e',
  warningDept:
    '\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u6388\u6743\u90e8\u95e8',
};

async function loadDeptTree() {
  if (deptTreeData.value.length > 0) {
    return;
  }
  deptTreeData.value = handleTree(
    await getSimpleDeptList(),
  ) as SystemDeptApi.Dept[];
}

async function loadConfig() {
  loading.value = true;
  try {
    await loadDeptTree();
    const config = await getSaleCartFirstApproveConfig();
    formData.value = {
      enabled: config.enabled ?? true,
      deptAuthEnabled: config.deptAuthEnabled ?? false,
      includeChildDept: config.includeChildDept ?? true,
      deptIds: config.deptIds ?? [],
    };
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  if (
    formData.value.enabled &&
    formData.value.deptAuthEnabled &&
    formData.value.deptIds.length === 0
  ) {
    message.warning(text.warningDept);
    return;
  }
  saving.value = true;
  try {
    await updateSaleCartFirstApproveConfig(formData.value);
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
    <div class="mx-auto max-w-[760px]">
      <Alert class="mb-4" show-icon type="info" :message="text.info" />

      <div class="rounded border border-gray-200 bg-white p-6">
        <Skeleton :loading="loading" active>
          <Form :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
            <FormItem :label="text.enableFirstApprove">
              <Switch v-model:checked="formData.enabled" />
            </FormItem>
            <FormItem :label="text.deptAuth">
              <Switch
                v-model:checked="formData.deptAuthEnabled"
                :disabled="!formData.enabled"
              />
            </FormItem>
            <FormItem
              v-if="formData.enabled && formData.deptAuthEnabled"
              :label="text.authDept"
            >
              <TreeSelect
                v-model:value="formData.deptIds"
                allow-clear
                class="w-full"
                multiple
                :placeholder="text.placeholderDept"
                show-search
                tree-node-filter-prop="name"
                :field-names="{
                  label: 'name',
                  value: 'id',
                  children: 'children',
                }"
                :tree-data="deptTreeData"
              />
            </FormItem>
            <FormItem
              v-if="formData.enabled && formData.deptAuthEnabled"
              :label="text.childDept"
            >
              <Checkbox v-model:checked="formData.includeChildDept">
                {{ text.childDeptTip }}
              </Checkbox>
            </FormItem>
            <FormItem :wrapper-col="{ offset: 6, span: 16 }">
              <Button
                v-access:code="['erp:sale-cart:first-approve-config']"
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
