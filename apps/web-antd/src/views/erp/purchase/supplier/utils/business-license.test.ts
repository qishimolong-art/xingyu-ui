import { describe, expect, it } from 'vitest';

import { buildSupplierBusinessInfoFromOcr } from './business-license';

describe('supplier business license OCR artifact mapping', () => {
  it('creates a business info record whenever OCR has a result', () => {
    const businessInfo = buildSupplierBusinessInfoFromOcr(23, {
      invoiceCompany: '杭州星宇供应链有限公司',
      invoiceAddress: '浙江省杭州市滨江区长河街道',
    });

    expect(businessInfo).toMatchObject({
      supplierId: 23,
      companyName: '杭州星宇供应链有限公司',
      registeredAddress: '浙江省杭州市滨江区长河街道',
      remark: '营业执照 OCR 自动识别',
    });
    expect(businessInfo?.rawData).toContain('杭州星宇供应链有限公司');
  });

  it('keeps no-op behavior before OCR has returned', () => {
    expect(buildSupplierBusinessInfoFromOcr(23, undefined)).toBeUndefined();
  });
});
