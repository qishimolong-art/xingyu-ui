import { nextTick } from 'vue';

interface VxeColumnCustomGrid {
  resetCustom: (options: true) => Promise<unknown>;
  saveCustom: () => Promise<unknown>;
}

/**
 * Wait until VXE has really applied the column customization before callers
 * rebuild adaptive columns. VXE emits `reset` before its own async reset ends,
 * so an idempotent awaited reset is required to avoid reloading stale storage.
 */
export async function settleVxeColumnCustomization(
  grid: VxeColumnCustomGrid,
  type?: string,
) {
  if (type !== 'confirm' && type !== 'reset') return false;

  // VXE emits both events before its async storage work is guaranteed to have
  // settled. Repeating the idempotent action gives callers a stable baseline.
  await (type === 'reset' ? grid.resetCustom(true) : grid.saveCustom());
  await nextTick();
  return true;
}
