import '../styles/candidate-focus.css';
import type { InjectionKey, Ref } from 'vue';
import { inject, ref } from 'vue';

export const CANDIDATE_FOCUS_KEY: InjectionKey<Readonly<Ref<boolean>>> = Symbol(
  'erp-candidate-focus',
);
export const CANDIDATE_POPUP_CLASS = 'erp-candidate-focus-popup';

const CANDIDATE_COMPONENTS = new Set([
  'Select',
  'ApiSelect',
  'SupplierLazySelect',
  'CustomerLazySelect',
  'SaleCustomerLazySelect',
  'ErpLazyPageSelect',
  'TreeSelect',
  'ApiTreeSelect',
  'Cascader',
  'ApiCascader',
  'QuickCreateApiSelect',
  'QuickCreateApiTreeSelect',
]);

export function appendCandidatePopupClass(value?: unknown): string {
  return [
    ...new Set([
      ...(typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : []),
      CANDIDATE_POPUP_CLASS,
    ]),
  ].join(' ');
}

export function useCandidatePopupClass() {
  const enabled = inject(CANDIDATE_FOCUS_KEY, ref(false));
  return (value?: string) =>
    enabled.value ? appendCandidatePopupClass(value) : value;
}

export function useCandidateSchema() {
  const enabled = inject(CANDIDATE_FOCUS_KEY, ref(false));
  return <T extends { component?: unknown; componentProps?: unknown }>(
    schema: T[],
  ): T[] => (enabled.value ? withCandidateFocus(schema) : schema);
}

export function withCandidateFocus<
  T extends {
    component?: unknown;
    componentProps?: unknown;
  },
>(schema: T[]): T[] {
  return schema.map((field) => {
    if (!CANDIDATE_COMPONENTS.has(String(field.component ?? ''))) return field;
    const decorate = (value: unknown) => {
      const props =
        value && typeof value === 'object'
          ? (value as Record<string, unknown>)
          : {};
      if (
        props.mode === 'multiple' ||
        props.mode === 'tags' ||
        props.multiple ||
        props.treeCheckable
      )
        return props;
      return {
        ...props,
        popupClassName: appendCandidatePopupClass(props.popupClassName),
      };
    };
    const original = field.componentProps;
    return {
      ...field,
      componentProps:
        typeof original === 'function'
          ? (...args: unknown[]) => decorate(original(...args))
          : decorate(original),
    };
  });
}
