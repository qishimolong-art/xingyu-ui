import { describe, expect, it, vi } from 'vitest';

import { withPurchaseDecimalSchemas } from '../purchase/utils/decimal-form';
import { withSaleDecimalSchemas } from '../sale/utils/decimal-form';

for (const [module, wrap] of [
  ['采购', withPurchaseDecimalSchemas],
  ['销售', withSaleDecimalSchemas],
] as const) {
  describe(`${module}主表小数输入生命周期`, () => {
    it('金额首次显示两位，输入时不改写，失焦保留六位有效小数', () => {
      const [schema] = wrap([{ component: 'Input', fieldName: 'feeAmount', label: '费用' }]);
      const values = { feeAmount: '1' };
      const actions = { setFieldValue: vi.fn(), setFieldError: vi.fn() };
      const getProps = schema!.componentProps as Function;
      expect(getProps(values, actions).value).toBe('1.00');
      getProps(values, actions).onFocus({});
      values.feeAmount = '1.234567';
      expect(getProps(values, actions).value).toBe('1.234567');
      expect(actions.setFieldValue).not.toHaveBeenCalled();
      getProps(values, actions).onBlur({ target: { value: '1.234567' } });
      expect(actions.setFieldValue).toHaveBeenLastCalledWith('feeAmount', '1.234567');
      getProps(values, actions).onBlur({ target: { value: '0.1' } });
      expect(actions.setFieldValue).toHaveBeenLastCalledWith('feeAmount', '0.10');
      getProps(values, actions).onBlur({ target: { value: '1.230000' } });
      expect(actions.setFieldValue).toHaveBeenLastCalledWith('feeAmount', '1.23');
    });

    it('第七位在失焦与提交校验中拒绝，不回写被截断的数值', () => {
      const [schema] = wrap([{ component: 'Input', fieldName: 'feeAmount', label: '费用' }]);
      const actions = { setFieldValue: vi.fn(), setFieldError: vi.fn() };
      const props = (schema!.componentProps as Function)({}, actions);
      props.onBlur({ target: { value: '1.1234567' } });
      expect(actions.setFieldValue).not.toHaveBeenCalled();
      expect(actions.setFieldError).toHaveBeenCalledWith('feeAmount', expect.stringContaining('6 位小数'));
      expect((schema!.rules as any).safeParse('1.1234567').success).toBe(false);
      expect((schema!.rules as any).safeParse('1e3').success).toBe(false);
    });

    it('数量允许0.5，张数保持整数，备注和只读输入不被回写', () => {
      const remark = { component: 'Input', fieldName: 'remark' };
      const [quantity, count, readonly, unchanged] = wrap([
        { component: 'Input', fieldName: 'totalCount' },
        { component: 'Input', fieldName: 'invoiceCount' },
        { component: 'Input', fieldName: 'totalPrice', componentProps: { disabled: true } },
        remark,
      ]);
      expect((quantity!.rules as any).safeParse('0.5').success).toBe(true);
      expect((count!.rules as any).safeParse('0.5').success).toBe(false);
      const actions = { setFieldValue: vi.fn() };
      (readonly!.componentProps as Function)({}, actions).onBlur({ target: { value: '1' } });
      expect(actions.setFieldValue).not.toHaveBeenCalled();
      expect(unchanged).toBe(remark);
    });
  });
}
