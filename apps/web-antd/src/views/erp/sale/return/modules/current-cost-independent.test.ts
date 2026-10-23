import type { SaleReturnCurrentCostApi } from '#/api/erp/sale/return/current-cost';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, reactive } from 'vue';

import Confirmation from './current-cost-confirmation.vue';
import Review from './current-cost-review.vue';

const api = vi.hoisted(() => ({
  permissions: new Set<string>(),
  preview: vi.fn(),
  items: vi.fn(),
  confirm: vi.fn(),
  approve: vi.fn(),
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.every((code) => api.permissions.has(code)),
  }),
}));
vi.mock('#/api/erp/sale/return/current-cost', () => ({
  getSaleReturnCurrentCostPreview: api.preview,
  getSaleReturnCurrentCostItems: api.items,
  confirmSaleReturnCurrentCost: api.confirm,
}));
vi.mock('#/api/erp/sale/return', () => ({ confirmSaleReturn: api.approve }));
vi.mock('ant-design-vue', () => {
  const box = defineComponent({
    props: ['message', 'description'],
    setup:
      (p, { slots }) =>
      () =>
        h('div', [p.message, p.description, slots.default?.()]),
  });
  const input = defineComponent({
    inheritAttrs: false,
    props: ['value'],
    emits: ['update:value'],
    setup:
      (p, { emit, attrs }) =>
      () =>
        h('input', {
          ...attrs,
          value: p.value ?? '',
          onInput: (e: Event) =>
            emit('update:value', (e.target as HTMLInputElement).value),
        }),
  });
  const button = defineComponent({
    props: ['disabled', 'loading'],
    setup:
      (p, { attrs, slots }) =>
      () =>
        h(
          'button',
          { ...attrs, disabled: p.disabled || p.loading },
          slots.default?.(),
        ),
  });
  const modal = defineComponent({
    props: ['open', 'footer', 'confirmLoading', 'okButtonProps'],
    emits: ['ok', 'cancel'],
    setup:
      (p, { emit, slots }) =>
      () =>
        p.open
          ? h('section', [
              slots.default?.(),
              ...(p.footer === null
                ? []
                : [
                    h(
                      'button',
                      {
                        disabled: p.confirmLoading || p.okButtonProps?.disabled,
                        onClick: () => emit('ok'),
                      },
                      '保存成本确认版本',
                    ),
                  ]),
              h('button', { onClick: () => emit('cancel') }, '关闭弹窗'),
            ])
          : null,
  });
  const table = defineComponent({
    props: ['dataSource', 'columns', 'pagination'],
    setup:
      (p, { slots }) =>
      () =>
        h('article', [
          ...(p.dataSource || []).map((record: Record<string, unknown>) =>
            h(
              'div',
              (p.columns || []).map((column: { dataIndex: string }) =>
                h(
                  'span',
                  slots.bodyCell?.({ record, column }) ||
                    String(record[column.dataIndex] ?? ''),
                ),
              ),
            ),
          ),
          h('button', { onClick: () => p.pagination?.onChange?.(2) }, '下一页'),
        ]),
  });
  return {
    Alert: box,
    Button: button,
    Modal: modal,
    Table: table,
    Input: Object.assign(input, { TextArea: input }),
    InputNumber: input,
  };
});

const header: SaleReturnCurrentCostApi.Header = {
  id: 1,
  no: 'SR1',
  enabled: true,
  status: 'READY',
  reason: '',
  sourceStatus: 10,
  sourceSignature: 'source1',
  basisSignature: 'basis1',
  sourceItemCount: 2,
  latestRevision: 0,
  costMasked: false,
  canApprove: true,
  canConfirm: true,
  financialAmount: '160',
  settlementAmount: '180',
};
function item(id: number): SaleReturnCurrentCostApi.Item {
  return {
    sourceItemId: id,
    productId: id,
    productName: `配件${id}`,
    warehouseId: 1,
    warehouseName: '仓1',
    quantity: '1',
    financialAmount: '80',
    settlementAmount: '90',
    costSource: 'CURRENT_AVERAGE',
    reason: '',
    sourceSignature: 'source1',
    basisSignature: 'basis1',
  };
}
const cleanups: Array<() => void> = [];
function mount(
  component: Parameters<typeof createApp>[0],
  props: Record<string, unknown> = {},
) {
  const el = document.createElement('div');
  document.body.append(el);
  const app = createApp(component, props);
  const vm = app.mount(el);
  cleanups.push(() => {
    app.unmount();
    el.remove();
  });
  return { el, vm };
}
function mountReview() {
  const result = mount(Review);
  return { ...result, vm: result.vm as InstanceType<typeof Review> };
}
async function flush() {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
function click(el: HTMLElement, text: string) {
  const b = [...el.querySelectorAll('button')].find(
    (b) => b.textContent === text,
  );
  expect(b).toBeTruthy();
  b!.click();
}
function fill(el: HTMLElement, placeholder: string, value: string) {
  const input = [...el.querySelectorAll('input')].find(
    (i) => i.placeholder === placeholder,
  );
  expect(input).toBeTruthy();
  input!.value = value;
  input!.dispatchEvent(new Event('input', { bubbles: true }));
}
beforeEach(() => {
  vi.clearAllMocks();
  api.permissions = reactive(
    new Set([
      'erp:sale-return:confirm',
      'erp:sale-return-current-cost:query',
      'erp:sale-return-current-cost:confirm',
    ]),
  );
  api.preview.mockResolvedValue({ ...header });
  api.items.mockResolvedValue({ list: [item(1), item(2)], total: 2 });
  api.confirm.mockResolvedValue({ ...header, latestRevision: 1 });
  api.approve.mockResolvedValue(true);
});
afterEach(() => {
  cleanups.splice(0).forEach((fn) => fn());
});
describe('Agent-Test independent current-cost UI boundary', () => {
  it('historical approved return with missing cost never fetches current rows or offers approval', async () => {
    api.preview.mockResolvedValue({
      ...header,
      sourceStatus: 20,
      status: 'HISTORICAL_COST_MISSING',
      financialAmount: null,
      settlementAmount: null,
      basisSignature: '',
      canApprove: false,
      canConfirm: false,
    });
    const { vm, el } = mountReview();
    await vm.openView(1);
    await flush();
    expect(el.textContent).toContain('历史成本');
    expect(el.textContent).not.toContain('财务成本：160');
    expect(api.items).not.toHaveBeenCalled();
    expect(el.textContent).not.toContain('补齐或修改成本');
    expect(api.approve).not.toHaveBeenCalled();
  });
  it('confirm-only role cannot reveal either cost window or submit', async () => {
    api.permissions = reactive(
      new Set(['erp:sale-return-current-cost:confirm']),
    );
    const review = mountReview();
    await review.vm.prepareOrderConfirm(1);
    const form = mount(Confirmation, { header });
    await flush();
    expect(api.preview).not.toHaveBeenCalled();
    expect(api.items).not.toHaveBeenCalled();
    expect(form.el.textContent).not.toContain('160');
    click(form.el, '保存成本确认版本');
    await flush();
    expect(api.confirm).not.toHaveBeenCalled();
    expect(api.approve).not.toHaveBeenCalled();
  });
  it('manual submission contains all 205 paginated rows and inherits valid evidence per row', async () => {
    const fullHeader = {
      ...header,
      sourceItemCount: 205,
      financialAmount: '16400',
      settlementAmount: '18450',
    };
    api.preview.mockResolvedValue(fullHeader);
    api.items.mockImplementation(
      (
        _header: SaleReturnCurrentCostApi.Header,
        pageNo: number,
        size: number,
      ) =>
        Promise.resolve({
          list: Array.from(
            { length: Math.min(size, 205 - (pageNo - 1) * size) },
            (_, index) => item((pageNo - 1) * size + index + 1),
          ),
          total: 205,
        }),
    );
    const { el } = mount(Confirmation, { header: fullHeader });
    await flush();
    fill(el, '核对依据（必填，最多500字）', '完整205行确认');
    await flush();
    click(el, '保存成本确认版本');
    await flush();
    expect(api.items).toHaveBeenCalledTimes(3);
    expect(api.confirm).toHaveBeenCalledTimes(1);
    const body = api.confirm.mock
      .calls[0]![0] as SaleReturnCurrentCostApi.Confirmation;
    expect(body.items).toHaveLength(205);
    expect(new Set(body.items.map((row) => row.sourceItemId)).size).toBe(205);
    expect(body.items[204]).toMatchObject({
      sourceItemId: 205,
      financialAmount: '80',
      settlementAmount: '90',
      evidence: '完整205行确认',
    });
    expect(body.expectedBasisSignature).toBe('basis1');
  });
  it('large six-place cost remains a string and missing second-line cost is not turned into zero', async () => {
    api.items.mockResolvedValue({
      list: [
        {
          ...item(1),
          financialAmount: '123456789012345.123456',
          settlementAmount: '0',
        },
        { ...item(2), financialAmount: null },
      ],
      total: 2,
    });
    const { el } = mount(Confirmation, { header });
    await flush();
    fill(el, '核对依据（必填，最多500字）', '零与缺失逐项核对');
    await flush();
    click(el, '保存成本确认版本');
    await flush();
    expect(api.confirm).not.toHaveBeenCalled();
    const fields = [
      ...el.querySelectorAll<HTMLInputElement>(
        'input[placeholder="必须明确填写"]',
      ),
    ];
    expect(fields).toHaveLength(4);
    expect(fields[0]!.value).toBe('123456789012345.123456');
    expect(fields[1]!.value).toBe('0');
    expect(fields[2]!.value).toBe('');
    fields[2]!.value = '0';
    fields[2]!.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    click(el, '保存成本确认版本');
    await flush();
    expect(api.confirm).toHaveBeenCalledTimes(1);
    const body = api.confirm.mock
      .calls[0]![0] as SaleReturnCurrentCostApi.Confirmation;
    expect(body.items[0]!.financialAmount).toBe('123456789012345.123456');
    expect(body.items[0]!.settlementAmount).toBe('0');
    expect(body.items[1]!.financialAmount).toBe('0');
  });
});
