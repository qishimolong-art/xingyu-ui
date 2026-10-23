import { describe, expect, it } from 'vitest';

import { getTransferOutSuccessMessage } from './purchase-in-transfer-out';

describe('getTransferOutSuccessMessage', () => {
  it('shows the split document count when multiple ids are returned', () => {
    expect(getTransferOutSuccessMessage({ id: 101, ids: [101, 102] })).toBe(
      '已按来源仓库生成 2 张调拨出库单',
    );
  });

  it('keeps the legacy single-document feedback', () => {
    expect(getTransferOutSuccessMessage({ id: 101 })).toBe('已生成调拨出库单');
  });
});
