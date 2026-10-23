<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import {
  Alert,
  Button,
  message,
  Radio,
  RadioGroup,
  Space,
  Tag,
  Typography,
  Upload,
} from 'ant-design-vue';

import {
  getImportTemplate,
  importSubjects,
} from '#/api/erp/finance/accounting/subject';
import ImportTemplateGuide from '#/components/import-template-guide/ImportTemplateGuide.vue';

const emit = defineEmits(['success']);

const fileRef = ref<File | null>(null);
/** 预检结果 */
const preview = ref<{
  existedCodes: string[];
  createdCodes: string[];
  failures: Array<{ subjectCode: string; reason: string }>;
} | null>(null);
/** 用户对重复项的处理选择：覆盖 / 跳过 */
const duplicateMode = ref<'OVERWRITE' | 'SKIP'>('OVERWRITE');
/** 最终导入结果 */
const finalResult = ref<{
  createdCodes: string[];
  updatedCodes: string[];
  skippedCodes: string[];
  failures: Array<{ subjectCode: string; reason: string }>;
} | null>(null);

const hasDuplicate = computed(
  () => (preview.value?.existedCodes?.length ?? 0) > 0,
);

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!fileRef.value) {
      message.warning('请先选择 Excel 文件');
      return;
    }
    if (finalResult.value) {
      // 已经导入完成，再点确定就关闭
      await modalApi.close();
      return;
    }
    // 第一阶段：预检
    if (!preview.value) {
      modalApi.lock();
      try {
        const result = await importSubjects(fileRef.value, 'DRY_RUN');
        preview.value = {
          existedCodes: result.existedCodes ?? [],
          createdCodes: result.createdCodes ?? [],
          failures: result.failures ?? [],
        };
        if (!hasDuplicate.value) {
          // 无重复，直接走真实导入（mode=SKIP 即可，因为没重复）
          await doRealImport('SKIP');
        }
      } finally {
        modalApi.unlock();
      }
      return;
    }
    // 第二阶段：根据用户选择真实导入
    await doRealImport(duplicateMode.value);
  },
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      fileRef.value = null;
      preview.value = null;
      finalResult.value = null;
      duplicateMode.value = 'OVERWRITE';
    }
  },
});

async function doRealImport(mode: 'OVERWRITE' | 'SKIP') {
  if (!fileRef.value) return;
  modalApi.lock();
  try {
    const result = await importSubjects(fileRef.value, mode);
    finalResult.value = {
      createdCodes: result.createdCodes ?? [],
      updatedCodes: result.updatedCodes ?? [],
      skippedCodes: result.skippedCodes ?? [],
      failures: result.failures ?? [],
    };
    message.success(
      `导入完成：新增 ${finalResult.value.createdCodes.length}，覆盖 ${finalResult.value.updatedCodes.length}，跳过 ${finalResult.value.skippedCodes.length}，失败 ${finalResult.value.failures.length}`,
    );
    emit('success');
  } finally {
    modalApi.unlock();
  }
}

/** 上传前拦截：文件存到本地 ref，不立即上传 */
function beforeUpload(file: FileType) {
  fileRef.value = file as File;
  preview.value = null;
  finalResult.value = null;
  return false;
}

/** 移除已选文件 */
function handleRemove() {
  fileRef.value = null;
  preview.value = null;
  finalResult.value = null;
  return true;
}

/** 下载导入模板 */
async function handleDownloadTemplate() {
  const data = await getImportTemplate();
  downloadFileFromBlobPart({
    fileName: '会计科目导入模板.xls',
    source: data,
  });
}

const confirmText = computed(() => {
  if (finalResult.value) return '完成';
  if (preview.value && hasDuplicate.value) return '确认导入';
  return '开始导入';
});
</script>

<template>
  <Modal class="w-1/2" title="导入会计科目">
    <div class="mx-4 space-y-4">
      <Alert
        type="info"
        show-icon
        message="支持新增 + 覆盖已有：上传文件后先预检；若存在重复编码会让你选择覆盖或跳过。仅支持 .xls / .xlsx 格式。"
      />
      <ImportTemplateGuide
        summary="会计科目导入模板用于批量新增或更新科目资料，上传后系统会先预检科目编码是否已存在。"
        :tips="[
          '科目编码用于识别唯一科目，重复编码会进入覆盖或跳过选择。',
          '上级科目、科目类型、余额方向等字段请按模板示例填写。',
        ]"
      />

      <div>
        <div class="mb-2 font-medium">选择文件</div>
        <Upload
          :max-count="1"
          accept=".xls,.xlsx"
          :before-upload="beforeUpload"
          @remove="handleRemove"
        >
          <Button type="primary">选择 Excel 文件</Button>
        </Upload>
      </div>

      <!-- 预检结果 -->
      <div v-if="preview && !finalResult" class="rounded border bg-gray-50 p-3">
        <Typography.Title :level="5" class="!mb-2">预检结果</Typography.Title>
        <div class="text-sm space-y-2">
          <div>
            <Tag color="blue">新增</Tag>
            {{ preview.createdCodes.length }} 条
            <span v-if="preview.createdCodes.length > 0" class="text-gray-500">
              （{{ preview.createdCodes.slice(0, 5).join(', ')
              }}{{ preview.createdCodes.length > 5 ? '…' : '' }}）
            </span>
          </div>
          <div>
            <Tag color="orange">已存在</Tag>
            {{ preview.existedCodes.length }} 条
            <span v-if="preview.existedCodes.length > 0" class="text-gray-500">
              （{{ preview.existedCodes.slice(0, 5).join(', ')
              }}{{ preview.existedCodes.length > 5 ? '…' : '' }}）
            </span>
          </div>
        </div>

        <div v-if="hasDuplicate" class="mt-3">
          <div class="mb-2 font-medium text-orange-500">
            存在 {{ preview.existedCodes.length }} 条重复编码，请选择处理方式：
          </div>
          <RadioGroup v-model:value="duplicateMode">
            <Radio value="OVERWRITE">覆盖已有（用 Excel 中的字段更新）</Radio>
            <Radio value="SKIP">跳过重复（只新增不存在的科目）</Radio>
          </RadioGroup>
        </div>
      </div>

      <!-- 最终导入结果 -->
      <div v-if="finalResult" class="rounded border bg-green-50 p-3">
        <Typography.Title :level="5" class="!mb-2">导入结果</Typography.Title>
        <div class="text-sm space-y-1">
          <div>
            <Tag color="green">新增</Tag>
            {{ finalResult.createdCodes.length }} 条
          </div>
          <div>
            <Tag color="cyan">覆盖更新</Tag>
            {{ finalResult.updatedCodes.length }} 条
          </div>
          <div>
            <Tag>跳过</Tag>
            {{ finalResult.skippedCodes.length }} 条
          </div>
          <div v-if="finalResult.failures.length > 0">
            <Tag color="red">失败</Tag>
            {{ finalResult.failures.length }} 条
            <div class="mt-1 max-h-[120px] overflow-auto bg-white p-2 text-xs">
              <div
                v-for="(fail, idx) in finalResult.failures"
                :key="idx"
                class="text-red-500"
              >
                {{ fail.subjectCode }}：{{ fail.reason }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #prepend-footer>
      <Space>
        <Button @click="handleDownloadTemplate">下载导入模板</Button>
      </Space>
    </template>
    <template #confirmText>{{ confirmText }}</template>
  </Modal>
</template>
