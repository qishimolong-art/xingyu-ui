import { readFileSync } from 'node:fs';
import { createApp, defineComponent, h, provide, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { PURCHASE_CANDIDATE_FOCUS_KEY } from '../purchase/utils/candidate-focus';
import {
  appendCandidatePopupClass,
  CANDIDATE_FOCUS_KEY,
  useCandidatePopupClass,
  useCandidateSchema,
  withCandidateFocus,
} from './candidate-focus';

describe('ERP candidate focus scope', () => {
  it('decorates both customer selectors and dynamic props without invoking APIs or losing callbacks', () => {
    const api = vi.fn();
    const onChange = vi.fn();
    for (const component of ['CustomerLazySelect', 'SaleCustomerLazySelect']) {
      const resolve = vi.fn((value: boolean) => ({
        api,
        onChange,
        disabled: value,
        pageSize: 10,
        popupClassName: 'original',
      }));
      const [field] = withCandidateFocus([
        { component, componentProps: resolve },
      ]);
      const props = field!.componentProps(true);
      expect(props).toEqual({
        api,
        onChange,
        disabled: true,
        pageSize: 10,
        popupClassName: 'original erp-candidate-focus-popup',
      });
      expect(resolve).toHaveBeenCalledExactlyOnceWith(true);
    }
    expect(api).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps ordinary multi-select and department checkbox semantics untouched', () => {
    for (const componentProps of [
      { mode: 'multiple' },
      { mode: 'tags' },
      { multiple: true },
      { treeCheckable: true },
    ]) {
      const [field] = withCandidateFocus([
        { component: 'Select', componentProps },
      ]);
      expect(field!.componentProps).toBe(componentProps);
    }
    expect(appendCandidatePopupClass('old erp-candidate-focus-popup old')).toBe(
      'old erp-candidate-focus-popup',
    );
    expect(PURCHASE_CANDIDATE_FOCUS_KEY).toBe(CANDIDATE_FOCUS_KEY);
  });

  it('inherits local context reactively and remains off outside opted-in forms', () => {
    const enabled = ref(false);
    const observations: Array<{
      popup: string | undefined;
      decorated: boolean;
    }> = [];
    const schema = [{ component: 'CustomerLazySelect' }];
    const Child = defineComponent({
      setup() {
        const popup = useCandidatePopupClass();
        const decorate = useCandidateSchema();
        return () => {
          observations.push({
            popup: popup('old'),
            decorated: decorate(schema) !== schema,
          });
          return h('div');
        };
      },
    });
    for (const optedIn of [false, true]) {
      enabled.value = optedIn;
      const app = createApp(
        defineComponent({
          setup() {
            if (optedIn) provide(CANDIDATE_FOCUS_KEY, enabled);
            return () => h(Child);
          },
        }),
      );
      app.mount(document.createElement('div'));
      app.unmount();
    }
    expect(observations).toEqual([
      { popup: 'old', decorated: false },
      { popup: 'old erp-candidate-focus-popup', decorated: true },
    ]);
  });

  it('opts in five sales documents while keeping the unused sales order and shared components default-off', () => {
    const read = (relative: string) =>
      readFileSync(new URL(relative, import.meta.url), 'utf8');
    for (const document of ['cart', 'quote', 'return', 'out', 'priceadjust']) {
      expect(read(`../sale/${document}/data.ts`)).toContain(
        'withCandidateFocus',
      );
      expect(
        read(
          `../sale/${document}/modules/${document === 'out' ? 'form' : 'item-form'}.vue`,
        ),
      ).toContain('candidate-focus-highlight');
    }
    const order = read('../sale/order/modules/item-form.vue');
    expect(order).not.toContain('candidate-focus-highlight');
    expect(order).not.toContain('CANDIDATE_FOCUS_KEY');
    expect(read('../sale/order/data.ts')).not.toContain('withCandidateFocus');
    expect(read('../components/ErpInlineStockSelect.vue')).toContain(
      'candidateFocusHighlight: false',
    );
    expect(
      read('../sale/components/SaleStockProductSelectModal.vue'),
    ).toContain('candidateFocusHighlight: false');
  });
});
