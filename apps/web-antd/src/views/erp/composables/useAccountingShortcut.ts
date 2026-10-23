import { useErpListShortcut } from './useErpListShortcut';

export function useAccountingShortcut(
  options: Parameters<typeof useErpListShortcut>[0],
) {
  return useErpListShortcut(options);
}
