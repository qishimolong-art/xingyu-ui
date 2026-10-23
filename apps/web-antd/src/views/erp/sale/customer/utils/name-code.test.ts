import { describe, expect, it } from 'vitest';

import { buildCustomerPinyinCode, buildCustomerWubiCode } from './name-code';

describe('customer name code', () => {
  it('builds a pinyin initial for each Chinese character', () => {
    expect(buildCustomerPinyinCode('随便取个名字了')).toBe('SBQGMZL');
  });

  it('keeps letters and numbers while ignoring separators', () => {
    expect(buildCustomerPinyinCode('A-客户_01. ')).toBe('AKH01');
  });

  it('uses pinyin collation initials for product brand names', () => {
    expect(buildCustomerPinyinCode('美孚自动变速箱油 ATF 8LV, 12X1L')).toBe(
      'MFZDBSXYATF8LV12X1L',
    );
  });

  it('builds a Wubi 86 initial for each common Chinese character', () => {
    expect(buildCustomerWubiCode('测试客户')).toBe('IYPY');
    expect(buildCustomerWubiCode('随便取个名字了')).toBe('BWBWQPB');
  });

  it('keeps existing wubi generation available for previous samples', () => {
    expect(buildCustomerWubiCode('取名了')).toBe('BQB');
  });

  it('keeps letters and numbers while ignoring separators for wubi code', () => {
    expect(buildCustomerWubiCode('A-客户_01. ')).toBe('APY01');
  });

  it('keeps rebuilding wubi code for sequential single-character names', () => {
    expect(buildCustomerWubiCode('额')).toBe('P');
    expect(buildCustomerWubiCode('李')).toBe('S');
    expect(buildCustomerWubiCode('王')).toBe('G');
  });

  it('limits generated wubi code to 32 characters', () => {
    expect(
      buildCustomerWubiCode('中华人民共和国有限公司测试客户'.repeat(3)),
    ).toHaveLength(32);
  });
});
