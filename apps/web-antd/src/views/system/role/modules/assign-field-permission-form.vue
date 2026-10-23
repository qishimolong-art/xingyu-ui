<script lang="ts" setup>
import type { DataNode } from 'ant-design-vue/es/tree';
import type { FieldDefinition } from '#/api/system/permission/field';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message, Tree } from 'ant-design-vue';

import {
  assignRoleFieldPermission,
  getRoleFieldPermissions,
} from '#/api/system/permission/field';
import { $t } from '#/locales';

import { MODULE_ITEMS } from './module-items';

const emit = defineEmits(['success']);

type TreeKey = number | string;

const roleId = ref(0);
const definitionsByModule = ref<Record<string, FieldDefinition[]>>({});
const visibleFieldCheckedKeys = ref<TreeKey[]>([]);
const expandedKeys = ref<TreeKey[]>([]);

const moduleItems = MODULE_ITEMS;

const groupLabels: Record<string, string> = {
  base_info: '基础信息',
  extend_info: '扩展信息',
  main_form: '主表表单',
  other: '其他',
  price_info: '价格信息',
  stock_info: '库存信息',
  detail_item: '明细表格',
  basic_info: '基本信息',
  category_purchase: '分类与采购',
  settle_logistics: '结算与物流',
  address_info: '地址信息',
  invoice_info: '开票信息',
  finance_info: '财务信息',
  detail: '详情展示',
  contact_info: '联系信息',
  sale_info: '业务销售',
  logistics_info: '物流信息',
  system_info: '系统辅助',
  select_modal: '选择弹窗',
  stock_adjust: '库存调整',
  enable_control: '启用控制',
  operation_control: '作业控制',
  bank_info: '银行信息',
  status_info: '状态信息',
  expense_info: '费用信息',
  income_info: '收入信息',
  payable_info: '应付信息',
  receivable_info: '应收信息',
};

const groupSort = [
  'base_info',
  'bank_info',
  'status_info',
  'expense_info',
  'income_info',
  'payable_info',
  'receivable_info',
  'price_info',
  'extend_info',
  'stock_info',
  'main_form',
  'detail_item',
  'basic_info',
  'category_purchase',
  'settle_logistics',
  'address_info',
  'invoice_info',
  'finance_info',
  'detail',
  'contact_info',
  'sale_info',
  'logistics_info',
  'system_info',
  'select_modal',
  'stock_adjust',
  'enable_control',
  'operation_control',
];

function isFormFieldDefinition(_field: FieldDefinition) {
  return true;
}

function groupDefinitions(definitions: FieldDefinition[]) {
  return definitions.reduce<Record<string, FieldDefinition[]>>(
    (result, item) => {
      const group = item.fieldGroup || 'other';
      result[group] = result[group] || [];
      result[group].push(item);
      return result;
    },
    {},
  );
}

function sortGroupEntries(
  entries: Array<[string, FieldDefinition[]]>,
): Array<[string, FieldDefinition[]]> {
  return entries.toSorted(([left], [right]) => {
    const leftIndex = groupSort.includes(left)
      ? groupSort.indexOf(left)
      : groupSort.length;
    const rightIndex = groupSort.includes(right)
      ? groupSort.indexOf(right)
      : groupSort.length;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return left.localeCompare(right);
  });
}

function buildExpandedKeys() {
  const keys: TreeKey[] = [];
  const groupKeys = new Set<string>();
  moduleItems.forEach((item) => {
    const moduleDefinitions = definitionsByModule.value[item.key] || [];
    if (moduleDefinitions.length === 0) {
      return;
    }
    groupKeys.add(`module_group_${item.groupKey}`);
    keys.push(`module_form_${item.key}`);
    Object.keys(groupDefinitions(moduleDefinitions)).forEach((group) => {
      keys.push(`field_group_${item.key}_${group}`);
    });
  });
  expandedKeys.value = [...groupKeys, ...keys];
}

const treeData = computed<DataNode[]>(() => {
  const groupMap = moduleItems.reduce<Record<string, DataNode>>(
    (result, item) => {
      const moduleDefinitions = definitionsByModule.value[item.key] || [];
      if (moduleDefinitions.length === 0) {
        return result;
      }
      const groupNode = result[item.groupKey] || {
        children: [],
        key: `module_group_${item.groupKey}`,
        title: item.groupLabel,
      };
      result[item.groupKey] = groupNode;
      const groups = sortGroupEntries(
        Object.entries(groupDefinitions(moduleDefinitions)),
      ).map(([group, fields]) => ({
        children: fields.map((field) => ({
          key: field.id,
          title: field.fieldLabel,
        })),
        key: `field_group_${item.key}_${group}`,
        title: groupLabels[group] || '其他',
      }));
      groupNode.children?.push({
        children: groups,
        key: `module_form_${item.key}`,
        title: item.label,
      });
      return result;
    },
    {},
  );
  return Object.values(groupMap);
});

function getVisibleFieldIds() {
  return visibleFieldCheckedKeys.value.filter(
    (key): key is number => typeof key === 'number',
  );
}

function getFieldIdsByModule(module: string) {
  return (definitionsByModule.value[module] || []).map((item) => item.id);
}

function getDefinitionCount(module: string) {
  return (definitionsByModule.value[module] || []).length;
}

function getVisibleFieldIdsByModule(module: string) {
  const fieldIds = new Set(getFieldIdsByModule(module));
  return getVisibleFieldIds().filter((id) => fieldIds.has(id));
}

function getHiddenFieldIdsByModule(module: string) {
  const visibleIds = new Set(getVisibleFieldIdsByModule(module));
  return getFieldIdsByModule(module).filter((id) => !visibleIds.has(id));
}

function handleSelectAll() {
  visibleFieldCheckedKeys.value = Object.values(definitionsByModule.value)
    .flat()
    .map((item) => item.id);
}

function handleClear() {
  visibleFieldCheckedKeys.value = [];
}

async function loadAllModulePermissions() {
  const results = await Promise.all(
    moduleItems.map(async (item) => ({
      item,
      result: await getRoleFieldPermissions(roleId.value, item.key),
    })),
  );
  definitionsByModule.value = results.reduce<Record<string, FieldDefinition[]>>(
    (result, { item, result: permissionResult }) => {
      result[item.key] = permissionResult.definitions.filter(
        isFormFieldDefinition,
      );
      return result;
    },
    {},
  );
  visibleFieldCheckedKeys.value = results.flatMap(({ item, result }) => {
    const hiddenFieldIds = new Set(result.hiddenFieldIds);
    return (definitionsByModule.value[item.key] || [])
      .map((field) => field.id)
      .filter((id) => !hiddenFieldIds.has(id));
  });
  buildExpandedKeys();
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    modalApi.lock();
    try {
      await Promise.all(
        moduleItems
          .filter((item) => getDefinitionCount(item.key))
          .map((item) =>
            assignRoleFieldPermission({
              hiddenFieldIds: getHiddenFieldIdsByModule(item.key),
              module: item.key,
              roleId: roleId.value,
            }),
          ),
      );
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      definitionsByModule.value = {};
      visibleFieldCheckedKeys.value = [];
      expandedKeys.value = [];
      return;
    }
    const data = modalApi.getData<{ roleId: number }>();
    roleId.value = data.roleId;

    modalApi.lock();
    try {
      await loadAllModulePermissions();
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal title="字段权限" class="w-[720px]">
    <div class="mb-3 flex items-center gap-2">
      <Button size="small" @click="handleSelectAll">全部可见</Button>
      <Button size="small" @click="handleClear">全部隐藏</Button>
      <span class="text-sm text-gray-400"
        >勾选表示字段可见，取消勾选表示对该角色隐藏</span
      >
    </div>
    <Tree
      v-model:checked-keys="visibleFieldCheckedKeys"
      v-model:expanded-keys="expandedKeys"
      :selectable="false"
      :tree-data="treeData"
      checkable
    />
  </Modal>
</template>
