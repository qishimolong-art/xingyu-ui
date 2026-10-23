import { h } from 'vue';

import { Select } from 'ant-design-vue';

import { CANDIDATE_POPUP_CLASS } from '#/views/erp/utils/candidate-focus';

interface CandidatePageSizeParams {
  // VXE supplies $pager at runtime, although SizesSlotParams omits it.
  $pager?: {
    setPageSizeByEvent: (event: Event, value: number) => void;
  };
  options: Array<{ label: number | string; value: number | string }>;
  pageSize: number;
}

/** Keep VXE's own size-change path, including page bounds and one query. */
export function renderStockCandidatePageSizes(params: CandidatePageSizeParams) {
  const pager = params.$pager;
  if (!pager) throw new Error('Missing VXE pager in sizes slot');
  return h(Select, {
    class: 'vxe-pager--sizes stock-candidate-page-size',
    options: params.options,
    popupClassName: CANDIDATE_POPUP_CLASS,
    size: 'small',
    value: params.pageSize,
    onChange: (value) =>
      pager.setPageSizeByEvent(new Event('change'), Number(value)),
  });
}
