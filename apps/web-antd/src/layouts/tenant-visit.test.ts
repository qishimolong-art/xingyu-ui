import { describe, expect, it, vi } from 'vitest';

import {
  applyTenantVisitTransition,
  hasVisitableTenant,
  isVisitingTenant,
  resolveActiveTenantId,
  resolveNextVisitTenantId,
} from './tenant-visit';

describe('tenant visit state', () => {
  it('hides the entry when the authorized list only contains the login tenant', () => {
    expect(hasVisitableTenant([{ id: 1 }], 1)).toBe(false);
    expect(hasVisitableTenant([{ id: 1 }, { id: 162 }], 1)).toBe(true);
    expect(hasVisitableTenant([], 1)).toBe(false);
  });
  it('uses the login tenant until an administrator visits another tenant', () => {
    expect(resolveActiveTenantId(1, null)).toBe(1);
    expect(resolveActiveTenantId(1, 162)).toBe(162);
    expect(isVisitingTenant(1, null)).toBe(false);
    expect(isVisitingTenant(1, 1)).toBe(false);
    expect(isVisitingTenant(1, 162)).toBe(true);
  });

  it('clears the visit tenant when returning to the login tenant', () => {
    expect(resolveNextVisitTenantId(1, 162)).toBe(162);
    expect(resolveNextVisitTenantId(1, 1)).toBeNull();
  });

  it('sets the target tenant before closing tabs and refreshing the page', async () => {
    const actions: string[] = [];
    const setVisitTenantId = vi.fn((tenantId: null | number) => {
      actions.push(`set:${tenantId}`);
    });
    const closeOtherTabs = vi.fn(() => {
      actions.push('close');
    });
    const refreshTab = vi.fn(() => {
      actions.push('refresh');
    });

    await expect(
      applyTenantVisitTransition({
        closeOtherTabs,
        currentVisitTenantId: null,
        loginTenantId: 1,
        refreshTab,
        setVisitTenantId,
        targetTenantId: 162,
      }),
    ).resolves.toBe(162);
    expect(actions).toEqual(['set:162', 'close', 'refresh']);
  });

  it('clears the visit tenant when returning to the login tenant', async () => {
    const setVisitTenantId = vi.fn();

    await expect(
      applyTenantVisitTransition({
        closeOtherTabs: vi.fn(),
        currentVisitTenantId: 162,
        loginTenantId: 1,
        refreshTab: vi.fn(),
        setVisitTenantId,
        targetTenantId: 1,
      }),
    ).resolves.toBeNull();
    expect(setVisitTenantId).toHaveBeenCalledWith(null);
  });

  it('restores the previous tenant when page refresh fails', async () => {
    const setVisitTenantId = vi.fn();
    const error = new Error('refresh failed');

    await expect(
      applyTenantVisitTransition({
        closeOtherTabs: vi.fn(),
        currentVisitTenantId: 162,
        loginTenantId: 1,
        refreshTab: vi.fn().mockRejectedValue(error),
        setVisitTenantId,
        targetTenantId: 164,
      }),
    ).rejects.toThrow('refresh failed');
    expect(setVisitTenantId.mock.calls).toEqual([[164], [162]]);
  });
});
