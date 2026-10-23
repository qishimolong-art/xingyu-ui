import { describe, expect, it, vi } from 'vitest';

import { settleVxeColumnCustomization } from './vxe-column-custom';

describe('VXE column customization synchronization', () => {
  it('waits for an idempotent reset before reporting that columns are settled', async () => {
    let finishReset: (() => void) | undefined;
    const resetCustom = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishReset = resolve;
        }),
    );
    const saveCustom = vi.fn(() => Promise.resolve());
    let settled = false;

    const task = settleVxeColumnCustomization(
      { resetCustom, saveCustom },
      'reset',
    ).then((result) => {
      settled = true;
      return result;
    });

    expect(resetCustom).toHaveBeenCalledWith(true);
    expect(settled).toBe(false);

    finishReset?.();
    await expect(task).resolves.toBe(true);
    expect(settled).toBe(true);
    expect(saveCustom).not.toHaveBeenCalled();
  });

  it('waits for confirmed settings without resetting them again', async () => {
    const resetCustom = vi.fn(() => Promise.resolve());
    const saveCustom = vi.fn(() => Promise.resolve());

    await expect(
      settleVxeColumnCustomization({ resetCustom, saveCustom }, 'confirm'),
    ).resolves.toBe(true);
    expect(resetCustom).not.toHaveBeenCalled();
    expect(saveCustom).toHaveBeenCalledOnce();
  });

  it('ignores unrelated custom events', async () => {
    const resetCustom = vi.fn(() => Promise.resolve());
    const saveCustom = vi.fn(() => Promise.resolve());

    await expect(
      settleVxeColumnCustomization({ resetCustom, saveCustom }, 'close'),
    ).resolves.toBe(false);
    expect(resetCustom).not.toHaveBeenCalled();
    expect(saveCustom).not.toHaveBeenCalled();
  });
});
