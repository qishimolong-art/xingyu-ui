import { useErpListShortcut } from './useErpListShortcut';

export function useSaleShortcut(
  options: Parameters<typeof useErpListShortcut>[0],
) {
  return useErpListShortcut(options);
}
