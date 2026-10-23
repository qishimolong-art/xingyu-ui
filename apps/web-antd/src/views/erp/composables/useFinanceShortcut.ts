import { useErpListShortcut } from './useErpListShortcut';

export function useFinanceShortcut(
  options: Parameters<typeof useErpListShortcut>[0],
) {
  return useErpListShortcut(options);
}
