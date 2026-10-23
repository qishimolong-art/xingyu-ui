import { useErpListShortcut } from './useErpListShortcut';

export function useBaseShortcut(
  options: Parameters<typeof useErpListShortcut>[0],
) {
  return useErpListShortcut(options);
}
