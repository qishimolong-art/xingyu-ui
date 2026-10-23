import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadSupplierFieldVisibility } from './field-visibility';

const state = vi.hoisted(() => ({ config: vi.fn(), role: vi.fn() }));
vi.mock('#/api/erp/config/field', () => ({
  getRuntimeFieldConfigList: state.config,
}));
vi.mock('#/api/system/permission/field', () => ({
  getCurrentUserHiddenFields: state.role,
}));
beforeEach(() => {
  state.config.mockReset().mockResolvedValue([
    { fieldName: 'region', visible: false },
    { fieldName: 'invoiceTitle', visible: true },
  ]);
  state.role.mockReset().mockResolvedValue(['bankAccount']);
});
describe('supplier successful visibility snapshot', () => {
  it('keeps role restrictions and field aliases in a single snapshot', async () => {
    const value = await loadSupplierFieldVisibility();
    expect(value.hiddenFields).toEqual(['bankAccount']);
    expect(value.configHiddenFields).toEqual(
      expect.arrayContaining(['region', 'areaIds']),
    );
    expect(value.configFieldKeys).toEqual(
      expect.arrayContaining(['invoiceTitle', 'invoiceCompany']),
    );
    expect(state.config).toHaveBeenCalledTimes(1);
    expect(state.role).toHaveBeenCalledTimes(1);
  });
  it.each(['config', 'role'] as const)(
    'rejects failed %s loads instead of making every field editable',
    async (kind) => {
      state[kind].mockRejectedValueOnce(new Error('offline'));
      await expect(loadSupplierFieldVisibility()).rejects.toThrow('offline');
    },
  );
});
