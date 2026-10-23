import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
  appendPurchaseCandidatePopupClass,
  withPurchaseCandidateFocus,
} from './candidate-focus';

describe('purchase candidate focus opt-in', () => {
  it('merges popup classes without changing options, callbacks or pagination', () => {
    const api = vi.fn();
    const change = vi.fn();
    const options = [{ value: 1, label: '仓库' }];
    const original = [
      {
        component: 'ErpLazyPageSelect',
        componentProps: {
          popupClassName: 'existing',
          api,
          onChange: change,
          options,
          pageSize: 10,
        },
      },
    ];
    const [field] = withPurchaseCandidateFocus(original);
    expect(field!.componentProps).toEqual({
      ...original[0]!.componentProps,
      popupClassName: 'existing erp-candidate-focus-popup',
    });
    expect(original[0]!.componentProps.popupClassName).toBe('existing');
    expect(api).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
  });

  it('evaluates dynamic props with the same arguments and preserves disabled state', () => {
    const resolver = vi.fn((values: { disabled: boolean }) => ({
      disabled: values.disabled,
      popupClassName: 'dynamic',
    }));
    const [field] = withPurchaseCandidateFocus([
      { component: 'Select', componentProps: resolver },
    ]);
    const args = { disabled: true };
    expect((field!.componentProps as unknown as typeof resolver)(args)).toEqual(
      { disabled: true, popupClassName: 'dynamic erp-candidate-focus-popup' },
    );
    expect(resolver).toHaveBeenCalledExactlyOnceWith(args);
  });

  it('covers native and API single, tree, cascader and quick-create selectors only', () => {
    for (const component of [
      'Select',
      'ApiSelect',
      'SupplierLazySelect',
      'ErpLazyPageSelect',
      'TreeSelect',
      'ApiTreeSelect',
      'Cascader',
      'ApiCascader',
      'QuickCreateApiSelect',
      'QuickCreateApiTreeSelect',
    ]) {
      const [field] = withPurchaseCandidateFocus([{ component }]);
      expect(field).toHaveProperty(
        'componentProps.popupClassName',
        'erp-candidate-focus-popup',
      );
    }
    const input = { component: 'Input', componentProps: { readonly: true } };
    expect(withPurchaseCandidateFocus([input])[0]).toBe(input);
  });

  it('is idempotent when schemas are prepared repeatedly', () => {
    expect(
      appendPurchaseCandidatePopupClass(
        'existing erp-candidate-focus-popup existing',
      ),
    ).toBe('existing erp-candidate-focus-popup');
    const schema = [{ component: 'Select' }];
    expect(
      withPurchaseCandidateFocus(withPurchaseCandidateFocus(schema)),
    ).toEqual(withPurchaseCandidateFocus(schema));
  });

  it('keeps shared stock and sales entrypoints opt-in and preserves the return focus fix', () => {
    const read = (relative: string) =>
      readFileSync(new URL(relative, import.meta.url), 'utf8');
    const stock = read('../../components/StockProductSelectModal.vue');
    expect(stock).toContain('candidateFocusHighlight: false');
    expect(stock).toContain(
      'if (props.candidateFocusHighlight && !isReadonlySelection(row))',
    );
    const sale = read('../../sale/components/SaleStockProductSelectModal.vue');
    expect(sale).toContain('candidateFocusHighlight: false');
    const form = read('../return/modules/form.vue');
    const ordinary = form.slice(
      form.indexOf('function handleUpdateItems('),
      form.indexOf('function handleAppendItems('),
    );
    expect(ordinary).not.toMatch(/queueFocusFirstItemCountInput/);
  });
});
