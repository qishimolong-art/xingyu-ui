function pad2(value: number) {
  return String(value).padStart(2, '0');
}

export interface ErpGridOptionsWithForm {
  [key: string]: any;
  formOptions?: Record<string, any> & {
    keywordSearchPlaceholder?: string;
  };
}

const ERP_KEYWORD_FIELD_NAME = 'keyword';

export function createErpKeywordSearchSchema(
  options: { placeholder?: string } = {},
) {
  return {
    fieldName: ERP_KEYWORD_FIELD_NAME,
    label: '关键词',
    component: 'Input',
    componentProps: {
      placeholder: options.placeholder ?? '请输入关键词',
      allowClear: true,
      'data-erp-keyword-search-input': 'true',
    },
  };
}

export function withErpKeywordSearchSchema(
  schema: any,
  options: { placeholder?: string } = {},
) {
  if (!Array.isArray(schema)) {
    return schema;
  }
  if (schema.some((item) => item?.fieldName === ERP_KEYWORD_FIELD_NAME)) {
    return schema;
  }
  return [createErpKeywordSearchSchema(options), ...schema];
}

export function getCurrentTimestamp() {
  return Date.now();
}

export function getCurrentLocalDate(date = new Date()) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join('-');
}

export function getCurrentLocalMonth(date = new Date()) {
  return [date.getFullYear(), pad2(date.getMonth() + 1)].join('-');
}

export function getCurrentLocalDateTime(date = new Date()) {
  return `${getCurrentLocalDate(date)} ${[
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds()),
  ].join(':')}`;
}

export function withErpCollapsedSearchDefaults<
  T extends ErpGridOptionsWithForm,
>(options: T): T {
  if (!options.formOptions) {
    return options;
  }

  return {
    ...options,
    formOptions: {
      collapsed: true,
      collapsedRows: 1,
      ...options.formOptions,
      schema: withErpKeywordSearchSchema(options.formOptions.schema, {
        placeholder: options.formOptions.keywordSearchPlaceholder,
      }),
    },
  };
}
