import { describe, expect, it } from 'vitest';

import { buildCustomerBusinessInfoFromOcr } from './business-license';

describe('customer business license OCR artifact mapping', () => {
  it('creates a business info record whenever OCR has a result', () => {
    const businessInfo = buildCustomerBusinessInfoFromOcr(12, {
      invoiceCompany: '杭州星宇科技有限公司',
      invoiceAddress: '浙江省杭州市滨江区长河街道',
    });

    expect(businessInfo).toMatchObject({
      customerId: 12,
      remark: '营业执照 OCR 自动识别',
    });
    expect(businessInfo?.rawData).toContain('杭州星宇科技有限公司');
  });

  it('keeps no-op behavior before OCR has returned', () => {
    expect(buildCustomerBusinessInfoFromOcr(12, undefined)).toBeUndefined();
  });
});
