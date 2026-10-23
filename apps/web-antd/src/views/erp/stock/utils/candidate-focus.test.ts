import { readFileSync } from 'node:fs';

import { createApp, defineComponent, h, nextTick } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { renderStockCandidatePageSizes } from './candidate-focus';

vi.mock('ant-design-vue', () => ({
  Select: defineComponent({
    props: ['value', 'options', 'popupClassName'],
    emits: ['change'],
    setup:
      (props, { emit }) =>
      () =>
        h(
          'select',
          {
            value: props.value,
            'data-popup': props.popupClassName,
            onChange: (event: Event) =>
              emit('change', (event.target as HTMLSelectElement).value),
          },
          props.options.map((option: { label: string; value: number }) =>
            h('option', { value: option.value }, option.label),
          ),
        ),
  }),
}));

describe('inventory candidate scope and pagination', () => {
  it('delegates a size change once to the existing VXE pager event path without querying on render', async () => {
    const change = vi.fn();
    const options = [10, 20, 30, 50, 100, 200].map((value) => ({
      value,
      label: `${value} 条/页`,
    }));
    const host = document.createElement('div');
    const app = createApp({
      render: () =>
        renderStockCandidatePageSizes({
          $pager: { setPageSizeByEvent: change },
          options,
          pageSize: 20,
        }),
    });
    app.mount(host);
    try {
      expect(change).not.toHaveBeenCalled();
      const select = host.querySelector('select')!;
      expect(select.value).toBe('20');
      expect(select.dataset.popup).toBe('erp-candidate-focus-popup');
      expect([...select.options].map((option) => option.text)).toEqual(
        options.map((option) => option.label),
      );
      select.value = '50';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await nextTick();
      expect(change).toHaveBeenCalledExactlyOnceWith(expect.any(Event), 50);
      expect(change.mock.calls[0]![0].type).toBe('change');
    } finally {
      app.unmount();
    }
  });

  it('opts in nine document lists and six inline pickers without activating independent inventory pages or old popups', () => {
    const read = (relative: string) =>
      readFileSync(new URL(relative, import.meta.url), 'utf8');
    for (const document of [
      'in',
      'out',
      'move',
      'check',
      'transfer-in',
      'transfer-out',
      'warehouse-move',
      'inbill',
      'outbill',
    ]) {
      expect(
        read(
          `../${document}/${document === 'transfer-in' ? 'index.vue' : 'data.ts'}`,
        ),
      ).toContain('withCandidateFocus');
      expect(read(`../${document}/index.vue`)).toContain(
        'sizes: renderStockCandidatePageSizes',
      );
    }
    for (const document of [
      'in',
      'out',
      'move',
      'check',
      'transfer-out',
      'warehouse-move',
    ]) {
      expect(read(`../${document}/modules/item-form.vue`)).toContain(
        'candidate-focus-highlight',
      );
      expect(read(`../${document}/modules/form.vue`)).toContain(
        'provide(CANDIDATE_FOCUS_KEY, ref(true))',
      );
    }
    for (const document of [
      'stock',
      'record',
      'transfer-ledger',
      'warehouse',
    ]) {
      expect(read(`../${document}/data.ts`)).not.toContain(
        'withCandidateFocus',
      );
      expect(read(`../${document}/index.vue`)).not.toContain(
        'renderStockCandidatePageSizes',
      );
    }
    expect(read('../report/index.vue')).not.toContain(
      'renderStockCandidatePageSizes',
    );
    expect(read('../warehouse-move/modules/item-form.vue')).not.toContain(
      './stock-select-modal.vue',
    );
    expect(read('../../components/ErpInlineStockSelect.vue')).toContain(
      'candidateFocusHighlight: false',
    );
  });
});
