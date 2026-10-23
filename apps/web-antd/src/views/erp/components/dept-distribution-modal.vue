<script lang="ts" setup>
import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import DeptDistributionPanel from './dept-distribution-panel.vue';

const emit = defineEmits(['success']);

interface ModalData {
  title?: string;
  archiveName?: string;
  auth?: string[];
  record: { id?: number; name?: string };
  loadApi: (id: number) => Promise<DeptDistributionData>;
  saveApi: (data: DeptDistributionData) => Promise<unknown>;
}

interface DeptDistributionData {
  id: number;
  name?: string;
  deptId?: number;
  deptName?: string;
  deptIds?: number[];
  deptNames?: string;
  deptNameMap?: Record<number, string>;
  allowMultiDept?: boolean;
}

const modalData = ref<ModalData>();

const [Modal, modalApi] = useVbenModal({
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      modalData.value = undefined;
      return;
    }
    modalData.value = modalApi.getData<ModalData>();
  },
});
</script>

<template>
  <Modal
    :show-confirm-button="false"
    :title="modalData?.title || '分配部门'"
    class="w-[760px]"
  >
    <DeptDistributionPanel
      v-if="modalData"
      :archive-name="modalData.archiveName"
      :auth="modalData.auth"
      :load-api="modalData.loadApi"
      :record="modalData.record"
      :save-api="modalData.saveApi"
      @success="emit('success')"
    />
  </Modal>
</template>
