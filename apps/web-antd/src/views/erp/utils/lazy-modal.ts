import type { Ref } from 'vue';

import { nextTick } from 'vue';

const MAX_READY_FRAMES = 10;

function isModalApiReady(modalApi: object) {
  const runtimeApi = modalApi as {
    open?: unknown;
    setData?: unknown;
  };
  return (
    typeof runtimeApi.open === 'function' &&
    typeof runtimeApi.setData === 'function'
  );
}

function waitForFrame() {
  return new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || !window.requestAnimationFrame) {
      setTimeout(resolve, 0);
      return;
    }
    window.requestAnimationFrame(() => resolve());
  });
}

/**
 * Lazily mounts a connected Vben modal and waits until its inner component has
 * registered the modal API. A single nextTick is not sufficient for async
 * components because their setup runs in a later render cycle.
 */
export async function ensureModalReady(
  shouldRender: Ref<boolean>,
  modalApi: object,
  loadComponent?: () => Promise<unknown>,
) {
  await loadComponent?.();
  shouldRender.value = true;

  for (let index = 0; index < MAX_READY_FRAMES; index++) {
    await nextTick();
    if (isModalApiReady(modalApi)) {
      return;
    }
    await waitForFrame();
  }

  throw new Error('Modal API was not ready after mounting');
}
