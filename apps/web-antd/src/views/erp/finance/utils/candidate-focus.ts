import type { Ref } from 'vue';
import { h, inject, provide, ref } from 'vue';
import { Select } from 'ant-design-vue';
import {
  appendCandidatePopupClass,
  CANDIDATE_FOCUS_KEY,
  CANDIDATE_POPUP_CLASS,
  withCandidateFocus,
} from '#/views/erp/utils/candidate-focus';

interface CandidatePageSizeParams {
  // VXE supplies $pager at runtime, although SizesSlotParams omits it.
  $pager?: { setPageSizeByEvent: (event: Event, value: number) => void };
  options: Array<{ label: number | string; value: number | string }>;
  pageSize: number;
}

/** Delegate to VXE's original size-change path, including bounds and query. */
export function renderFinanceCandidatePageSizes(
  params: CandidatePageSizeParams,
) {
  const pager = params.$pager;
  if (!pager) throw new Error('Missing VXE pager in sizes slot');
  return h(Select, {
    class: 'vxe-pager--sizes finance-candidate-page-size',
    options: params.options,
    popupClassName: CANDIDATE_POPUP_CLASS,
    size: 'small',
    value: params.pageSize,
    onChange: (value) =>
      pager.setPageSizeByEvent(new Event('change'), Number(value)),
  });
}

function createCandidateControls(enabled: Readonly<Ref<boolean>>) {
  return {
    candidateSchema: <
      T extends { component?: unknown; componentProps?: unknown },
    >(
      schema: T[],
    ): T[] => (enabled.value ? withCandidateFocus(schema) : schema),
    candidatePopupClass: (value?: string) =>
      enabled.value ? appendCandidatePopupClass(value) : value,
    candidatePagerConfig: () =>
      enabled.value
        ? { slots: { sizes: renderFinanceCandidatePageSizes } }
        : {},
  };
}

/** Only business entrypoints opt in; shared schemas and consumers stay off. */
export function provideFinanceCandidateFocus(
  enabled: Readonly<Ref<boolean>> = ref(true),
) {
  provide(CANDIDATE_FOCUS_KEY, enabled);
  return createCandidateControls(enabled);
}

export function useFinanceCandidateFocus() {
  return createCandidateControls(inject(CANDIDATE_FOCUS_KEY, ref(false)));
}
