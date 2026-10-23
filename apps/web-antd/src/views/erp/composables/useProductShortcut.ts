import { useErpListShortcut } from './useErpListShortcut';

export function useProductShortcut(
  options: Parameters<typeof useErpListShortcut>[0],
) {
  return useErpListShortcut(options);
}
