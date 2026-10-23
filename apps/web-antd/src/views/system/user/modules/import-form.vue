<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';

import { useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, Upload } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { importUser, importUserTemplate } from '#/api/system/user';
import ImportTemplateGuide from '#/components/import-template-guide/ImportTemplateGuide.vue';

import { useImportFormSchema } from '../data';

const emit = defineEmits(['success']);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    formItemClass: 'col-span-2',
    labelWidth: 120,
  },
  layout: 'horizontal',
  schema: useImportFormSchema(),
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    modalApi.lock();
    // 提交表单
    const data = await formApi.getValues();
    try {
      const result = await importUser(data.file, data.updateSupport);
      const createCount = result.createUsernames?.length ?? 0;
      const updateCount = result.updateUsernames?.length ?? 0;
      const failures = Object.entries(result.failureUsernames ?? {});
      const successCount = createCount + updateCount;
      const summary = `新增 ${createCount} 条，更新 ${updateCount} 条，失败 ${failures.length} 条`;

      if (successCount === 0 && failures.length > 0) {
        const [mobile, reason] = failures[0]!;
        message.error(`导入失败：${mobile}，${reason}`);
        return;
      }

      // 关闭并提示
      await modalApi.close();
      emit('success');
      if (failures.length > 0) {
        const [mobile, reason] = failures[0]!;
        message.warning(`${summary}。首条失败：${mobile}，${reason}`, 6);
      } else {
        message.success(`导入成功，${summary}`);
      }
    } finally {
      modalApi.unlock();
    }
  },
});

/** 上传前 */
function beforeUpload(file: FileType) {
  formApi.setFieldValue('file', file);
  return false;
}

/** 下载模版 */
async function handleDownload() {
  const data = await importUserTemplate();
  downloadFileFromBlobPart({ fileName: '用户导入模板.xls', source: data });
}
</script>

<template>
  <Modal title="导入用户" class="w-1/3">
    <div class="mx-4 my-4">
      <ImportTemplateGuide
        summary="用户导入模板用于批量新增或更新系统用户。手机号、用户名等账号信息需要按模板填写，是否更新已有用户由下方表单选项控制。"
        :tips="[
          '手机号、用户名等唯一字段重复时，勾选更新支持后会尝试更新已有用户。',
          '部门、岗位、角色等关联字段请填写系统中已存在且启用的数据名称或编码。',
        ]"
      />
    </div>
    <Form class="mx-4">
      <template #file>
        <div class="w-full">
          <Upload
            :max-count="1"
            accept=".xls,.xlsx"
            :before-upload="beforeUpload"
          >
            <Button type="primary"> 选择 Excel 文件 </Button>
          </Upload>
        </div>
      </template>
    </Form>
    <template #prepend-footer>
      <div class="flex flex-auto items-center">
        <Button @click="handleDownload"> 下载导入模板 </Button>
      </div>
    </template>
  </Modal>
</template>
