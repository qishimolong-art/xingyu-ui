import { readFileSync } from 'node:fs';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import {
  provideFinanceCandidateFocus,
  renderFinanceCandidatePageSizes,
  useFinanceCandidateFocus,
} from './candidate-focus';

vi.mock('ant-design-vue', () => ({
  Select: { name: 'FinancePageSizeSelect', render: () => null },
}));

const entries = [
  'cash-bank/account',
  'cash-bank/transfer',
  'settlement/receipt',
  'settlement/payment',
  'settlement/offset',
  'receivable/account',
  'receivable/other-receivable',
  'receivable/other-income',
  'receivable/misc',
  'payable/account',
  'payable/other',
  'payable/expense',
  'payable/misc',
];
const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), 'utf8');

describe('finance candidate focus integration', () => {
  it('inherits entrypoint scope, defaults off and lets report scopes override enabled ancestors', async () => {
    const enabled = ref(true);
    const api = vi.fn();
    const onChange = vi.fn();
    const resolve = vi.fn((disabled: boolean) => ({
      disabled,
      api,
      onChange,
      pageSize: 10,
      popupClassName: 'original',
    }));
    const schema = [
      { component: 'ErpLazyPageSelect', componentProps: resolve },
    ];
    let controls!: ReturnType<typeof useFinanceCandidateFocus>;
    const Consumer = defineComponent({
      setup() {
        controls = useFinanceCandidateFocus();
        return () => h('span', controls.candidatePopupClass('old'));
      },
    });
    const mount = (mode: 'default' | 'business' | 'report') => {
      const app = createApp(
        defineComponent({
          setup() {
            if (mode !== 'default') provideFinanceCandidateFocus();
            const Scoped = defineComponent({
              setup() {
                if (mode === 'report') provideFinanceCandidateFocus(enabled);
                return () => h(Consumer);
              },
            });
            return () => h(Scoped);
          },
        }),
      );
      const host = document.createElement('div');
      app.mount(host);
      return { app, host };
    };
    const defaults = mount('default');
    expect(controls.candidateSchema(schema)).toBe(schema);
    expect(controls.candidatePagerConfig()).toEqual({});
    expect(defaults.host.textContent).toBe('old');
    defaults.app.unmount();
    const business = mount('business');
    const result = controls.candidateSchema(schema);
    expect(result).not.toBe(schema);
    expect(result[0]!.componentProps(true)).toEqual({
      disabled: true,
      api,
      onChange,
      pageSize: 10,
      popupClassName: 'original erp-candidate-focus-popup',
    });
    expect(resolve).toHaveBeenCalledExactlyOnceWith(true);
    expect(api).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(controls.candidatePagerConfig()).toEqual({
      slots: { sizes: renderFinanceCandidatePageSizes },
    });
    business.app.unmount();
    enabled.value = false;
    const report = mount('report');
    expect(controls.candidateSchema(schema)).toBe(schema);
    expect(controls.candidatePagerConfig()).toEqual({});
    expect(report.host.textContent).toBe('old');
    enabled.value = true;
    await nextTick();
    expect(report.host.textContent).toBe('old erp-candidate-focus-popup');
    enabled.value = false;
    await nextTick();
    expect(report.host.textContent).toBe('old');
    report.app.unmount();
  });

  it('preserves VXE options and delegates one size selection without changing data on render', () => {
    const change = vi.fn();
    const options = [
      { label: '10 条/页', value: 10 },
      { label: '50 条/页', value: 50 },
    ];
    const node = renderFinanceCandidatePageSizes({
      $pager: { setPageSizeByEvent: change },
      options,
      pageSize: 10,
    });
    expect(node.props?.options).toBe(options);
    expect(node.props?.value).toBe(10);
    expect(node.props?.popupClassName).toBe('erp-candidate-focus-popup');
    expect(change).not.toHaveBeenCalled();
    node.props!.onChange('50');
    expect(change).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledWith(expect.any(Event), 50);
  });

  it('preserves disabled nodes, ordinary multi-selects, calendars and radio groups', () => {
    let controls!: ReturnType<typeof useFinanceCandidateFocus>;
    const app = createApp(
      defineComponent({
        setup() {
          controls = provideFinanceCandidateFocus();
          return () => null;
        },
      }),
    );
    app.mount(document.createElement('div'));
    const disabled = {
      component: 'TreeSelect',
      componentProps: {
        disabled: true,
        treeData: [{ value: 1, disabled: true }],
      },
    };
    const multi = {
      component: 'Select',
      componentProps: { mode: 'multiple', popupClassName: 'old' },
    };
    const date = { component: 'DatePicker' };
    const radio = { component: 'RadioGroup' };
    const result = controls.candidateSchema<{
      component: string;
      componentProps?: unknown;
    }>([disabled, multi, date, radio]);
    expect(result[0]!.componentProps).toMatchObject({
      disabled: true,
      treeData: disabled.componentProps.treeData,
    });
    expect(result[1]!.componentProps).toBe(multi.componentProps);
    expect(result[2]).toBe(date);
    expect(result[3]).toBe(radio);
    app.unmount();
  });

  it.each(entries)(
    'opts in %s at its entrypoint and keeps shared query schemas unchanged',
    (entry) => {
      const page = read(`../${entry}/index.vue`);
      expect(page).toContain('provideFinanceCandidateFocus');
      expect(page).toContain('schema: candidateSchema(');
      expect(page).toContain('pagerConfig: candidatePagerConfig()');
      expect(read(`../${entry}/data.ts`)).not.toContain('candidate-focus');
    },
  );

  it('excludes report wrappers, shared report consumers and unused legacy forms', () => {
    for (const name of ['receivable', 'payable']) {
      expect(read(`../../report/${name}-account/index.vue`)).toContain(
        ':candidate-focus-highlight="false"',
      );
      const page = read(`../${name}/account/index.vue`);
      expect(page).toContain('candidateFocusHighlight: true');
      expect(page).toContain('props.candidateFocusHighlight');
      expect(read(`../${name}/account/modules/detail-drawer.vue`)).toContain(
        'useFinanceCandidateFocus',
      );
    }
    for (const page of [
      '../../report/account-fund/modules/account-fund-table.vue',
      '../../report/account-fund/modules/bank-transfer-readonly-table.vue',
      '../../report/expense-income/modules/expense-income-table.vue',
      '../../report/counterparty/modules/misc-readonly-table.vue',
      '../receivable/report/index.vue',
      '../payable/report/index.vue',
    ]) {
      expect(read(page)).not.toContain('provideFinanceCandidateFocus');
      expect(read(page)).not.toContain('candidateSchema');
    }
    for (const legacy of ['account', 'transfer', 'receipt', 'payment'])
      expect(read(`../${legacy}/modules/form.vue`)).not.toContain(
        'candidate-focus',
      );
  });
});
