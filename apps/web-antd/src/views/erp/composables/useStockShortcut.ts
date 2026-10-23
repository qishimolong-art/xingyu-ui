import { useErpListShortcut } from './useErpListShortcut';

export function useStockShortcut(
  options: Parameters<typeof useErpListShortcut>[0],
) {
  return useErpListShortcut(options);
}
