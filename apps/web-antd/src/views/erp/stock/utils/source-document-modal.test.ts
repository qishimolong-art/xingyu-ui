import { createApp, nextTick } from 'vue';

import { afterEach, describe, expect, it } from 'vitest';

import SourceDocumentModal from './source-document-modal.vue';

describe('stock source document modal', () => {
  let unmount: undefined | (() => void);

  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  it('does not mount any document form before navigation is requested', async () => {
    const container = document.createElement('div');
    const app = createApp(SourceDocumentModal);
    app.mount(container);
    unmount = () => app.unmount();

    await nextTick();

    expect(container.childElementCount).toBe(0);
  });
});
