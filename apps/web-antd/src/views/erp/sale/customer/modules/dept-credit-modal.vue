<script lang="ts" setup>
import type { ErpCustomerApi } from '#/api/erp/sale/customer';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import DeptCreditPanel from './dept-credit-panel.vue';

const emit = defineEmits<{ (e: 'success'): void }>();

const record = ref<ErpCustomerApi.Customer>();

const [Modal, modalApi] = useVbenModal({
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      record.value = undefined;
      return;
    }
    record.value = modalApi.getData<ErpCustomerApi.Customer>();
  },
});
</script>

<template>
  <Modal
    :show-confirm-button="false"
    :title="record?.name ? `分部门授信 - ${record.name}` : '分部门授信'"
    class="w-[880px]"
  >
    <DeptCreditPanel
      v-if="record"
      :record="record"
      @success="emit('success')"
    />
  </Modal>
</template>
