import { useErpListShortcut } from './useErpListShortcut';

export function usePurchaseShortcut(
  options: Parameters<typeof useErpListShortcut>[0],
) {
  return useErpListShortcut(options);
}
