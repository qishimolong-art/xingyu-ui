<script lang="ts" setup>
import type { ErpAccountingSubjectApi } from '#/api/erp/finance/accounting/subject';

import { computed, nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createAccountingSubject,
  getAccountingSubject,
  getAccountingSubjectByCode,
  updateAccountingSubject,
} from '#/api/erp/finance/accounting/subject';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<ErpAccountingSubjectApi.Subject>();
const FIELD_PERMISSION_MODULE = 'erp_accounting_subject';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
let isSettingValues = false;

const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['会计科目'])
    : $t('ui.actionTitle.create', ['会计科目']);
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-2',
    labelWidth: 100,
  },
  layout: 'horizontal',
  schema: useFormSchema(hiddenFields.value),
  showDefaultActions: false,
  handleValuesChange: async (values, changedFields) => {
    if (isSettingValues) {
      return;
    }
    // 选择父科目后自动计算层级 = 父级 + 1；清空则回到 1
    if (changedFields.includes('parentCode')) {
      const parentCode = values.parentCode;
      if (!parentCode) {
        await formApi.setFieldValue('subjectLevel', 1);
        return;
      }
      try {
        const parent = await getAccountingSubjectByCode(parentCode);
        const parentLevel = parent?.subjectLevel ?? 1;
        await formApi.setFieldValue('subjectLevel', parentLevel + 1);
        // 子科目继承父级余额方向（仅当当前未设置时）
        if (parent?.balanceDirection && !values.balanceDirection) {
          await formApi.setFieldValue(
            'balanceDirection',
            parent.balanceDirection,
          );
        }
      } catch {
        // 接口失败时降级为 2，避免阻塞用户
        await formApi.setFieldValue('subjectLevel', 2);
      }
    }
    // 切换科目类型时清空父科目编码（避免跨类目残留）
    if (changedFields.includes('subjectCategory')) {
      await formApi.setFieldValue('parentCode', undefined);
      await formApi.setFieldValue('subjectLevel', 1);
    }
    // 科目编码失焦/变更：检测唯一性，新增/编辑时同编码已存在则提示
    if (changedFields.includes('subjectCode')) {
      const code = values.subjectCode?.trim?.();
      if (!code) return;
      try {
        const exist = await getAccountingSubjectByCode(code);
        if (exist && exist.id && exist.id !== formData.value?.id) {
          message.error(`科目编码 ${code} 已存在，请更换`);
        }
      } catch {
        // 查询失败不阻塞
      }
    }
  },
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    const data = (await formApi.getValues()) as ErpAccountingSubjectApi.Subject;
    // 提交前再做一次编码唯一校验（前端兜底，后端是最终防线）
    if (data.subjectCode) {
      try {
        const exist = await getAccountingSubjectByCode(data.subjectCode);
        if (exist && exist.id && exist.id !== formData.value?.id) {
          message.error(`科目编码 ${data.subjectCode} 已存在，请更换`);
          return;
        }
      } catch {
        // 查询失败时由后端兜底
      }
    }
    modalApi.lock();
    // sort 字段已在表单中隐藏，按需求"取消提交校验"，统一兜底为 0
    if (data.sort == null) {
      data.sort = 0;
    }
    if (data.subjectLevel == null) {
      data.subjectLevel = data.parentCode ? 2 : 1;
    }
    // 编辑兜底：有父科目却仍是 level=1，按父级 level+1 修正，避免老数据 level=NULL 被错算
    if (data.parentCode && data.subjectLevel === 1) {
      try {
        const parent = await getAccountingSubjectByCode(data.parentCode);
        if (parent?.subjectLevel) {
          data.subjectLevel = parent.subjectLevel + 1;
        } else {
          data.subjectLevel = 2;
        }
      } catch {
        data.subjectLevel = 2;
      }
    }
    try {
      await (formData.value?.id
        ? updateAccountingSubject(data)
        : createAccountingSubject(data));
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = undefined;
      return;
    }
    await loadHiddenFields();
    formApi.setState({ schema: useFormSchema(hiddenFields.value) });
    const data = modalApi.getData<ErpAccountingSubjectApi.Subject>();
    if (!data) {
      formData.value = undefined;
      return;
    }
    // 编辑：拉详情；新增：用预填值（包括 parentCode、subjectCategory 等）
    isSettingValues = true;
    try {
      if (data.id) {
        modalApi.lock();
        try {
          formData.value = await getAccountingSubject(data.id);
          await formApi.setValues(formData.value);
          // 等 watcher 跑完（subjectCategory 触发的清空逻辑），再兜底重新写 parentCode
          await nextTick();
          if (formData.value?.parentCode) {
            await formApi.setFieldValue(
              'parentCode',
              formData.value.parentCode,
            );
          }
          if (formData.value?.subjectLevel != null) {
            await formApi.setFieldValue(
              'subjectLevel',
              formData.value.subjectLevel,
            );
          }
          // 一级科目（无 parentCode）禁用父科目编码；二级及以下允许修改父科目
          // 注：旧数据 subjectLevel 可能为 NULL，必须用 parentCode 判断，避免误判
          const isTopLevel =
            !formData.value?.parentCode &&
            (formData.value?.subjectLevel ?? 1) <= 1;
          formApi.updateSchema([
            {
              fieldName: 'parentCode',
              componentProps: {
                disabled: isTopLevel,
                placeholder: isTopLevel ? '一级科目无父级' : '请选择父科目',
              },
            },
          ]);
        } finally {
          modalApi.unlock();
        }
      } else {
        formData.value = undefined;
        await formApi.setValues(data);
        // 新增模式：恢复默认（不禁用）
        formApi.updateSchema([
          {
            fieldName: 'parentCode',
            componentProps: {
              disabled: false,
              placeholder: '请先选择科目类型，再选择父科目（一级科目留空）',
            },
          },
        ]);
      }
    } finally {
      isSettingValues = false;
    }
  },
});
</script>

<template>
  <Modal class="w-2/5" :title="getTitle">
    <Form class="mx-4" />
  </Modal>
</template>
