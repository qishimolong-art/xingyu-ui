import { describe, expect, it } from 'vitest';

import {
  collectErpBusinessPartnerOptionText,
  filterErpBusinessPartnerOption,
} from './business-partner-select';

describe('ERP business partner select search', () => {
  it('matches customer and supplier pinyin or wubi codes', () => {
    const option = {
      label: '北京星宇汽配',
      value: 1,
      raw: {
        code: 'C001',
        pinyinCode: 'BJXYQP',
        wubiCode: 'UQWX',
      },
    };

    expect(filterErpBusinessPartnerOption('bjxy', option)).toBe(true);
    expect(filterErpBusinessPartnerOption('uqwx', option)).toBe(true);
    expect(filterErpBusinessPartnerOption('missing', option)).toBe(false);
  });

  it('collects searchable fields from raw, origin, data, and option wrappers', () => {
    const option = {
      origin: { shortName: '星宇', contact: '张三' },
      data: { mobile: '13800138000', memberCode: 'VIP-009' },
      option: { platformCode: 'PLAT-ABC' },
    };

    expect(filterErpBusinessPartnerOption('张三', option)).toBe(true);
    expect(filterErpBusinessPartnerOption('vip-009', option)).toBe(true);
    expect(filterErpBusinessPartnerOption('plat-abc', option)).toBe(true);
  });

  it('keeps empty keywords matching every option', () => {
    expect(filterErpBusinessPartnerOption('', undefined)).toBe(true);
    expect(filterErpBusinessPartnerOption('   ', { label: '供应商' })).toBe(
      true,
    );
  });

  it('includes sale credit reason and selected value in collected text', () => {
    const option = {
      creditBlockedReason: '超授信额度',
      value: 1024,
    };

    expect(collectErpBusinessPartnerOptionText(option)).toContain('超授信额度');
    expect(filterErpBusinessPartnerOption('1024', option)).toBe(true);
  });
});
