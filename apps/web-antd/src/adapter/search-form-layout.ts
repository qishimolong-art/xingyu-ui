export interface GridOptionsWithSearchForm {
  [key: string]: any;
  formOptions?: Record<string, any>;
}

export const SEARCH_FORM_WRAPPER_CLASS =
  'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';

export function withFourColumnSearchFormLayout<
  T extends GridOptionsWithSearchForm,
>(options: T): T {
  if (!options.formOptions) {
    return options;
  }

  return {
    ...options,
    formOptions: {
      ...options.formOptions,
      wrapperClass: SEARCH_FORM_WRAPPER_CLASS,
    },
  };
}
