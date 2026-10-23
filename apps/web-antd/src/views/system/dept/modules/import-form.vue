<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';

import { useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, Upload } from 'ant-design-vue';

import { useVbenForm, z } from '#/adapter/form';
import { importDept, importDeptTemplate } from '#/api/system/dept';

const emit = defineEmits(['success']);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    formItemClass: 'col-span-2',
    labelWidth: 120,
  },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'file',
      label: '部门数据',
      component: 'Upload',
      rules: 'required',
      help: '仅允许导入 xls、xlsx 格式文件',
    },
    {
      fieldName: 'updateSupport',
      label: '是否覆盖',
      component: 'Switch',
      componentProps: {
        checkedChildren: '是',
        unCheckedChildren: '否',
      },
      rules: z.boolean().default(false),
      help: '是否更新同一上级下已经存在的部门',
    },
  ],
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    modalApi.lock();
    const data = await formApi.getValues();
    try {
      const result = await importDept(data.file, data.updateSupport);
      const createCount = result.createNames?.length ?? 0;
      const updateCount = result.updateNames?.length ?? 0;
      const failures = Object.entries(result.failureNames ?? {});
      const successCount = createCount + updateCount;
      const summary = `新增 ${createCount} 条，更新 ${updateCount} 条，失败 ${failures.length} 条`;

      if (successCount === 0 && failures.length > 0) {
        const [name, reason] = failures[0]!;
        message.error(`导入失败：${name}，${reason}`);
        return;
      }

      await modalApi.close();
      emit('success');
      if (failures.length > 0) {
        const [name, reason] = failures[0]!;
        message.warning(`${summary}。首条失败：${name}，${reason}`, 6);
      } else {
        message.success(`导入成功：${summary}`);
      }
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formApi.resetForm();
    }
  },
});

function beforeUpload(file: FileType) {
  formApi.setFieldValue('file', file);
  return false;
}

async function handleDownload() {
  const data = await importDeptTemplate();
  downloadFileFromBlobPart({ fileName: '部门导入模板.xls', source: data });
}
</script>

<template>
  <Modal title="导入部门" class="w-1/3">
    <Form class="mx-4">
      <template #file>
        <div class="w-full">
          <Upload
            :max-count="1"
            accept=".xls,.xlsx"
            :before-upload="beforeUpload"
          >
            <Button type="primary">选择 Excel 文件</Button>
          </Upload>
        </div>
      </template>
    </Form>
    <template #prepend-footer>
      <div class="flex flex-auto items-center">
        <Button @click="handleDownload">下载导入模板</Button>
      </div>
    </template>
  </Modal>
</template>
