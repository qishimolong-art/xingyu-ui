const interactiveCellSelector = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'label',
  '.ant-btn',
  '.ant-dropdown',
  '.ant-dropdown-trigger',
  '.ant-image',
  '.ant-image-img',
  '.ant-image-mask',
  '.ant-input',
  '.ant-input-affix-wrapper',
  '.ant-input-number',
  '.ant-picker',
  '.ant-radio-wrapper',
  '.ant-select',
  '.ant-switch',
  '.ant-tree-select',
  '.ant-upload',
  '.table-actions',
  '.vxe-cell--checkbox',
  '.vxe-cell--radio',
  '.vxe-cell--tree-node',
  '.vxe-table--expanded',
].join(',');

export function handleMallTradeSearchEnter(
  event: KeyboardEvent,
  query: () => Promise<unknown> | unknown,
) {
  const target = event.target as HTMLElement | null;
  const tagName = target?.tagName;

  if (
    target?.isContentEditable ||
    tagName === 'TEXTAREA' ||
    target?.closest('.ant-select-dropdown, .ant-picker-dropdown')
  ) {
    return;
  }

  event.preventDefault();
  void query();
}

export function shouldIgnoreMallTradeRowDetailClick({
  column,
  event,
}: {
  column?: any;
  event?: Event;
}) {
  if (
    column?.type === 'expand' ||
    column?.type === 'checkbox' ||
    column?.type === 'radio' ||
    column?.field === 'actions' ||
    column?.slots?.default === 'actions'
  ) {
    return true;
  }

  const target = event?.target as HTMLElement | null;
  return !!target?.closest(interactiveCellSelector);
}
