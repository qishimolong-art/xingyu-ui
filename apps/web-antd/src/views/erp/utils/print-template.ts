import type { ErpPrintApi } from '#/api/erp/print';

import { ref } from 'vue';

import { message } from 'ant-design-vue';

import { getPrintTemplateList } from '#/api/erp/print';

interface PrintableRow {
  id?: number | string;
  itemOrderDirection?: 'asc' | 'desc';
  itemOrderField?: string;
  no?: string;
}

type TemplateSelectHandler<T extends PrintableRow> = (
  row: T,
  templateId: number | string,
) => Promise<void> | void;

interface UseErpPrintTemplateOptions {
  moduleKey: string;
  moduleName: string;
  openModal: (data: {
    businessId?: number | string;
    businessNo?: string;
    moduleKey: string;
    moduleName: string;
    itemOrderDirection?: 'asc' | 'desc';
    itemOrderField?: string;
    templateId?: number | string;
  }) => void;
}

export function useErpPrintTemplate<T extends PrintableRow>({
  moduleKey,
  moduleName,
  openModal,
}: UseErpPrintTemplateOptions) {
  const selectorOpen = ref(false);
  const templateOptions = ref<ErpPrintApi.Template[]>([]);
  const selectedTemplateId = ref<number | string>();
  const pendingRow = ref<T>();
  const pendingTemplateHandler = ref<TemplateSelectHandler<T>>();

  function defaultTemplateId(templates: ErpPrintApi.Template[]) {
    return templates.find((item) => item.defaulted)?.id ?? templates[0]?.id;
  }

  function openDesigner() {
    openModal({ moduleKey, moduleName });
  }

  async function selectTemplate(row: T, handler: TemplateSelectHandler<T>) {
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
        await handler(row, templates[0]?.id as number | string);
        return;
      }
      pendingRow.value = row;
      pendingTemplateHandler.value = handler;
      templateOptions.value = templates;
      selectedTemplateId.value = defaultTemplateId(templates);
      selectorOpen.value = true;
    } finally {
      hideLoading();
    }
  }

  function printRow(row: T) {
    return selectTemplate(row, (targetRow, templateId) => {
      openModal({
        businessId: targetRow.id,
        businessNo: targetRow.no,
        moduleKey,
        moduleName,
        itemOrderDirection: targetRow.itemOrderDirection,
        itemOrderField: targetRow.itemOrderField,
        templateId,
      });
    });
  }

  async function confirmTemplate() {
    if (
      !pendingRow.value ||
      !selectedTemplateId.value ||
      !pendingTemplateHandler.value
    ) {
      return;
    }
    await pendingTemplateHandler.value(
      pendingRow.value,
      selectedTemplateId.value,
    );
    selectorOpen.value = false;
    pendingRow.value = undefined;
    pendingTemplateHandler.value = undefined;
  }

  function cancelTemplateSelect() {
    selectorOpen.value = false;
    pendingRow.value = undefined;
    pendingTemplateHandler.value = undefined;
  }

  return {
    cancelTemplateSelect,
    confirmTemplate,
    openDesigner,
    printRow,
    selectTemplate,
    selectedTemplateId,
    selectorOpen,
    templateOptions,
  };
}
