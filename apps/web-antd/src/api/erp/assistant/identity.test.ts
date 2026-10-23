import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  access: {
    accessToken: 'initial',
    tenantId: 1,
    visitTenantId: null as null | number,
  },
  user: { userInfo: { id: 1 } },
}));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => state.access,
  useUserStore: () => state.user,
}));
vi.mock('@vben/hooks', () => ({ useAppConfig: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: {} }));

import { identity } from './index';

describe('assistant account identity', () => {
  it('keeps results across token rotation but isolates user, tenant and logout', () => {
    const original = identity();
    state.access.accessToken = 'rotated';
    expect(identity()).toBe(original);
    state.user.userInfo.id = 2;
    expect(identity()).not.toBe(original);
    state.user.userInfo.id = 1;
    state.access.tenantId = 2;
    expect(identity()).not.toBe(original);
    state.access.tenantId = 1;
    state.access.visitTenantId = 3;
    expect(identity()).not.toBe(original);
    state.access.visitTenantId = null;
    state.access.accessToken = '';
    expect(identity()).not.toBe(original);
    expect(original).not.toContain('initial');
  });
});
