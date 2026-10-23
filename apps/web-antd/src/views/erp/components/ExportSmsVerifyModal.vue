<script lang="ts" setup>
import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Input, message } from 'ant-design-vue';

interface ModalData {
  mobile?: string;
  tip?: string;
}

const FIXED_CODE = '123456';
const DEFAULT_TIP =
  '\u8bf7\u8f93\u5165\u77ed\u4fe1\u9a8c\u8bc1\u7801\u540e\u7ee7\u7eed\u5bfc\u51fa';
const ERROR_MESSAGE = '\u9a8c\u8bc1\u7801\u9519\u8bef';
const MOBILE_LABEL = '\uff0c\u624b\u673a\u53f7\uff1a';
const MODAL_TITLE = '\u77ed\u4fe1\u9a8c\u8bc1';
const PLACEHOLDER = '\u8bf7\u8f93\u5165\u9a8c\u8bc1\u7801';

const emit = defineEmits<{
  confirm: [code: string];
}>();

const code = ref('');
const mobile = ref('');
const tip = ref(DEFAULT_TIP);

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (code.value.trim() !== FIXED_CODE) {
      message.warning(ERROR_MESSAGE);
      return;
    }
    emit('confirm', code.value.trim());
    await modalApi.close();
  },
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      code.value = '';
      mobile.value = '';
      tip.value = DEFAULT_TIP;
      return;
    }
    const data = modalApi.getData<ModalData>() || {};
    mobile.value = data.mobile || '';
    tip.value = data.tip || DEFAULT_TIP;
  },
});

function handleEnter() {
  modalApi.onConfirm();
}
</script>

<template>
  <Modal :title="MODAL_TITLE" class="w-[420px]">
    <div class="px-4 py-3">
      <div class="mb-3 text-sm text-gray-600">
        {{ tip }}
        <span v-if="mobile">{{ MOBILE_LABEL }}{{ mobile }}</span>
      </div>
      <Input
        v-model:value="code"
        allow-clear
        autofocus
        :placeholder="PLACEHOLDER"
        @press-enter="handleEnter"
      />
    </div>
  </Modal>
</template>
