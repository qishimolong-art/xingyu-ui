import { describe, expect, it } from 'vitest';

import {
  formatCustomerExtendNumberFields,
  getCustomerExtendNumberError,
  normalizeCustomerExtendNumberFields,
} from './extend-info-number';

describe('customer extend info number fields', () => {
  it('accepts optional decimal text and reports non-numeric input', () => {
    expect(getCustomerExtendNumberError('advanceAmount', '')).toBeUndefined();
    expect(
      getCustomerExtendNumberError('advanceAmount', '-12.50'),
    ).toBeUndefined();
    expect(getCustomerExtendNumberError('advanceAmount', '12元')).toBe(
      '预收款金额必须是数字',
    );
    expect(getCustomerExtendNumberError('advanceAmount', '1.234')).toBe(
      '预收款金额最多输入 2 位小数',
    );
  });

  it('preserves integer and range validation from the previous number controls', () => {
    expect(getCustomerExtendNumberError('settleDay', '15')).toBeUndefined();
    expect(getCustomerExtendNumberError('settleDay', '1.5')).toBe(
      '结账日期必须是整数',
    );
    expect(getCustomerExtendNumberError('settleDay', '32')).toBe(
      '结账日期不能大于 31',
    );
    expect(getCustomerExtendNumberError('discountPriceLevel', '2.5')).toBe(
      '优惠价格级别必须是整数',
    );
  });

  it('formats API numbers as text and normalizes valid text for submission', () => {
    const formatted = formatCustomerExtendNumberFields({
      advanceAmount: 12.5,
      legalPerson: '测试法人',
      settleDay: 20,
    });
    expect(formatted).toMatchObject({
      advanceAmount: '12.5',
      legalPerson: '测试法人',
      settleDay: '20',
    });

    const normalized = normalizeCustomerExtendNumberFields({
      advanceAmount: ' 12.50 ',
      legalPerson: '测试法人',
      pointsRate: '',
      settleDay: '20',
    });
    expect(normalized).toMatchObject({
      advanceAmount: 12.5,
      legalPerson: '测试法人',
      pointsRate: undefined,
      settleDay: 20,
    });
  });
});
