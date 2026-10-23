import type { ErpPrintApi } from '#/api/erp/print';

import { ref } from 'vue';

import { message } from 'ant-design-vue';

import { getPrintTemplateList } from '#/api/erp/print';

interface PrintableRow {
  id?: number | string;
  no?: string;
}

interface UsePurchasePrintTemplateOptions {
  moduleKey: string;
  moduleName: string;
  openModal: (data: {
    businessId?: number | string;
    businessNo?: string;
    moduleKey: string;
    moduleName: string;
    templateId?: number | string;
  }) => void;
}

export function usePurchasePrintTemplate<T extends PrintableRow>({
  moduleKey,
  moduleName,
  openModal,
}: UsePurchasePrintTemplateOptions) {
  const selectorOpen = ref(false);
  const templateOptions = ref<ErpPrintApi.Template[]>([]);
  const selectedTemplateId = ref<number | string>();
  const pendingRow = ref<T>();

  function defaultTemplateId(templates: ErpPrintApi.Template[]) {
    return templates.find((item) => item.defaulted)?.id ?? templates[0]?.id;
  }

  function openDesigner() {
    openModal({ moduleKey, moduleName });
  }

  async function printRow(row: T) {
    const hideLoading = message.loading({
      content: '正在读取打印模板...',
      duration: 0,
    });
    try {
      const templates = await getPrintTemplateList(moduleKey);
      if (!templates.length) {
        message.warning('暂无可用打印模板，请联系管理员设置');
        return;
      }
      if (templates.length === 1) {
        openModal({
          businessId: row.id,
          businessNo: row.no,
          moduleKey,
          moduleName,
          templateId: templates[0]?.id,
        });
        return;
      }
      pendingRow.value = row;
      templateOptions.value = templates;
      selectedTemplateId.value = defaultTemplateId(templates);
      selectorOpen.value = true;
    } finally {
      hideLoading();
    }
  }

  function confirmTemplate() {
    if (!pendingRow.value || !selectedTemplateId.value) {
      return;
    }
    openModal({
      businessId: pendingRow.value.id,
      businessNo: pendingRow.value.no,
      moduleKey,
      moduleName,
      templateId: selectedTemplateId.value,
    });
    selectorOpen.value = false;
    pendingRow.value = undefined;
  }

  function cancelTemplateSelect() {
    selectorOpen.value = false;
    pendingRow.value = undefined;
  }

  return {
    cancelTemplateSelect,
    confirmTemplate,
    openDesigner,
    printRow,
    selectedTemplateId,
    selectorOpen,
    templateOptions,
  };
}
