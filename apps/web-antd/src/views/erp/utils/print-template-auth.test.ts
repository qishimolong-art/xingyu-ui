import { isProxy, reactive } from 'vue';

import { describe, expect, it } from 'vitest';

import { buildPrintTemplateAuthPayload } from './print-template-auth';

describe('buildPrintTemplateAuthPayload', () => {
  it('converts reactive access codes into a structured-clone-safe array', () => {
    const accessState = reactive({
      accessCodes: [
        'erp:purchase-in:print-template',
        'erp:print-template:delete',
      ],
      accessToken: 'test-access-token',
      tenantId: 1,
      visitTenantId: 2,
    });

    expect(isProxy(accessState.accessCodes)).toBe(true);

    const payload = buildPrintTemplateAuthPayload(accessState);

    expect(isProxy(payload.accessCodes)).toBe(false);
    expect(payload).toEqual({
      accessCodes: [
        'erp:purchase-in:print-template',
        'erp:print-template:delete',
      ],
      accessToken: 'test-access-token',
      tenantId: 1,
      visitTenantId: 2,
    });
    expect(() => structuredClone(payload)).not.toThrow();
  });
});
