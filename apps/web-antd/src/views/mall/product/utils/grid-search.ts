export function handleMallProductSearchEnter(
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
