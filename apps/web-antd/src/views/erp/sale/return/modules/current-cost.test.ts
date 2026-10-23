import type { SaleReturnCurrentCostApi } from '#/api/erp/sale/return/current-cost';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, reactive } from 'vue';

import { tradeCell } from '#/views/erp/report/trade-v2/trade-ui';

import Confirmation from './current-cost-confirmation.vue';
import Review from './current-cost-review.vue';
import {
  loadCompleteCurrentCostItems,
  validateCurrentCost,
} from './current-cost';

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
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
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
describe('无单成本下单确认与补齐', () => {
  it('two costs differ and one order confirmation uses reviewed basis', async () => {
    const { el, vm } = mountReview();
    expect(await vm.prepareOrderConfirm(1)).toBe(true);
    await flush();
    expect(el.textContent).toContain('财务成本：160');
    expect(el.textContent).toContain('部门结算成本：180');
    click(el, '确认成本并下单确认');
    click(el, '确认成本并下单确认');
    await flush();
    expect(api.approve).toHaveBeenCalledTimes(1);
    expect(api.approve).toHaveBeenCalledWith(1, 'basis1');
    expect(api.confirm).not.toHaveBeenCalled();
  });
  it('only explicit DISABLED permits original flow', async () => {
    const { vm } = mountReview();
    api.preview.mockResolvedValue({
      ...header,
      enabled: false,
      status: 'DISABLED',
    });
    expect(await vm.prepareOrderConfirm(1)).toBe(false);
    expect(api.items).not.toHaveBeenCalled();
    api.preview.mockRejectedValue(new Error('403'));
    expect(await vm.prepareOrderConfirm(1)).toBe(true);
    expect(api.approve).not.toHaveBeenCalled();
  });
  it('cancellation and late previews do not revive a closed source', async () => {
    const { vm, el } = mountReview();
    const pending = deferred<SaleReturnCurrentCostApi.Header>();
    api.preview.mockReturnValue(pending.promise);
    const opening = vm.prepareOrderConfirm(1);
    await flush();
    click(el, '取消');
    pending.resolve({ ...header });
    expect(await opening).toBe(true);
    await flush();
    expect(el.textContent).toBe('');
    expect(api.items).not.toHaveBeenCalled();
    expect(api.approve).not.toHaveBeenCalled();
  });
  it('switching sources discards the old late response', async () => {
    const { vm, el } = mountReview();
    const pending = deferred<SaleReturnCurrentCostApi.Header>();
    api.preview
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({ ...header, id: 2, no: 'SR2' });
    const first = vm.openView(1);
    await vm.openView(2);
    pending.resolve({ ...header });
    await first;
    await flush();
    expect(el.textContent).toContain('SR2');
    expect(el.textContent).not.toContain('SR1');
  });
  it('stale approval stays open and never silently retries with a new basis', async () => {
    const { el, vm } = mountReview();
    await vm.prepareOrderConfirm(1);
    api.approve.mockRejectedValue(new Error('成本水位已变化'));
    await flush();
    click(el, '确认成本并下单确认');
    await flush();
    expect(el.textContent).toContain('成本水位已变化');
    click(el, '确认成本并下单确认');
    expect(api.approve).toHaveBeenCalledTimes(1);
    expect(api.preview).toHaveBeenCalledTimes(1);
  });
  it('POSTED displays historical returned amounts and cannot approve or confirm', async () => {
    api.preview.mockResolvedValue({
      ...header,
      status: 'POSTED',
      canApprove: false,
      canConfirm: false,
    });
    const { vm, el } = mountReview();
    await vm.openView(1);
    await flush();
    expect(el.textContent).toContain('已过账成本（历史快照）');
    expect(el.textContent).not.toContain('补齐或修改成本');
    expect(api.approve).not.toHaveBeenCalled();
  });
  it('historical approved without new posting costs remains unavailable', async () => {
    api.preview.mockResolvedValue({
      ...header,
      status: 'HISTORICAL_COST_MISSING',
      sourceStatus: 20,
      sourceItemCount: 0,
      financialAmount: null,
      settlementAmount: null,
      canApprove: false,
      canConfirm: false,
    });
    const { vm, el } = mountReview();
    await vm.openView(1);
    await flush();
    expect(el.textContent).toContain('历史成本未记录');
    expect(el.textContent).toContain('财务成本：不可用');
    expect(el.textContent).not.toContain('补齐或修改成本');
    expect(api.items).not.toHaveBeenCalled();
    expect(api.approve).not.toHaveBeenCalled();
  });
  it('no permissions causes no requests; revoked permission hides old costs', async () => {
    api.permissions.clear();
    const { vm, el } = mountReview();
    await vm.prepareOrderConfirm(1);
    expect(api.preview).not.toHaveBeenCalled();
    api.permissions.add('erp:sale-return:confirm');
    await nextTick();
    await vm.prepareOrderConfirm(1);
    await flush();
    api.permissions.clear();
    await flush();
    expect(el.textContent).toBe('');
  });
  it('masked previews cannot expose returned amounts or approve', async () => {
    api.preview.mockResolvedValue({
      ...header,
      costMasked: true,
      canApprove: false,
      canConfirm: false,
    });
    const { vm, el } = mountReview();
    await vm.prepareOrderConfirm(1);
    await flush();
    expect(el.textContent).toContain('财务成本：****');
    expect(el.textContent).not.toContain('财务成本：160');
    click(el, '确认成本并下单确认');
    expect(api.approve).not.toHaveBeenCalled();
  });
  it('complete paginated loading rejects repeated or changed rows', async () => {
    api.items
      .mockResolvedValueOnce({ list: [item(1)], total: 2 })
      .mockResolvedValueOnce({ list: [item(2)], total: 2 });
    expect((await loadCompleteCurrentCostItems(header)).length).toBe(2);
    expect(api.items).toHaveBeenLastCalledWith(header, 2, 100);
    api.items.mockResolvedValue({ list: [item(1)], total: 2 });
    await expect(loadCompleteCurrentCostItems(header)).rejects.toThrow('重复');
    api.items.mockResolvedValue({
      list: [{ ...item(1), basisSignature: 'new' }],
      total: 2,
    });
    await expect(loadCompleteCurrentCostItems(header)).rejects.toThrow('变化');
  });
  it('explicit zero is valid while null and >500 evidence are rejected', () => {
    expect(
      validateCurrentCost(
        [{ ...item(1), financialAmount: '0', settlementAmount: '0' }],
        '零成本已核对',
      ),
    ).toBeUndefined();
    expect(
      validateCurrentCost([{ ...item(1), financialAmount: null }], '依据'),
    ).toContain('明确填写');
    expect(validateCurrentCost([item(1)], 'x'.repeat(501))).toContain('500');
  });
  it('failed confirmation keeps inputs and retries same full payload/key', async () => {
    api.confirm
      .mockRejectedValueOnce(new Error('网络中断'))
      .mockResolvedValueOnce(header);
    const { el } = mount(Confirmation, { header });
    await flush();
    fill(el, '核对依据（必填，最多500字）', '逐行核对库存凭据');
    await flush();
    click(el, '保存成本确认版本');
    await flush();
    expect(el.textContent).toContain('网络中断');
    expect((el.querySelector('input') as HTMLInputElement).value).toBe(
      '逐行核对库存凭据',
    );
    const sent = api.confirm.mock.calls[0]![0];
    expect(sent.items).toHaveLength(2);
    expect(sent.items[0]).toMatchObject({
      financialAmount: '80',
      settlementAmount: '90',
      evidence: '逐行核对库存凭据',
    });
    click(el, '保存成本确认版本');
    await flush();
    expect(api.confirm.mock.calls[1]![0]).toEqual(sent);
  });
  it('changed source before manual confirmation preserves input without submitting', async () => {
    const { el } = mount(Confirmation, { header });
    await flush();
    fill(el, '核对依据（必填，最多500字）', '原始依据');
    api.preview.mockResolvedValue({ ...header, basisSignature: 'changed' });
    click(el, '保存成本确认版本');
    await flush();
    expect(api.confirm).not.toHaveBeenCalled();
    expect(el.textContent).toContain('输入已保留');
  });
  it('no-original-sale does not invent original salesperson', () => {
    expect(
      tradeCell(
        {
          saleUserName: null,
          metricStates: { saleUserName: 'NO_ORIGINAL_SALE' },
        },
        'saleUserName',
      ),
    ).toBe('无原销售记录');
    expect(
      tradeCell({ currentHandlerName: '本次经办人' }, 'currentHandlerName'),
    ).toBe('本次经办人');
    expect(
      tradeCell(
        {
          positiveQuantity: '0',
          originalSaleQuantity: null,
          metricStates: { originalSaleQuantity: 'NO_ORIGINAL_SALE' },
        },
        'positiveQuantity',
      ),
    ).toBe('0');
    expect(
      tradeCell(
        {
          originalSaleQuantity: null,
          metricStates: { originalSaleQuantity: 'NO_ORIGINAL_SALE' },
        },
        'originalSaleQuantity',
      ),
    ).toBe('无原销售记录');
    expect(tradeCell({ costBasis: 'MANUAL_CONFIRMED' }, 'costBasis')).toBe(
      '人工确认成本',
    );
  });
  it('missing display names show stable IDs and item rows remain visible', async () => {
    api.items.mockResolvedValue({
      list: [
        { ...item(1), warehouseName: undefined, productName: undefined },
        item(2),
      ],
      total: 2,
    });
    const { vm, el } = mountReview();
    await vm.openView(1);
    await flush();
    expect(el.textContent).toContain('仓库 #1');
    expect(el.textContent).toContain('配件 #1');
  });
  it('incomplete displayed page blocks approval', async () => {
    api.items.mockResolvedValue({ list: [item(1)], total: 2 });
    const { vm, el } = mountReview();
    await vm.prepareOrderConfirm(1);
    await flush();
    expect(el.textContent).toContain('本页成本明细不完整');
    click(el, '确认成本并下单确认');
    expect(api.approve).not.toHaveBeenCalled();
  });
  it('manual form mounts without crypto.randomUUID and disables editing while submitted', async () => {
    vi.stubGlobal('crypto', {});
    const pending = deferred<SaleReturnCurrentCostApi.Header>();
    api.confirm.mockReturnValue(pending.promise);
    try {
      const { el } = mount(Confirmation, { header });
      await flush();
      fill(el, '核对依据（必填，最多500字）', '核对');
      await flush();
      click(el, '保存成本确认版本');
      await flush();
      expect([...el.querySelectorAll('input')].every((i) => i.disabled)).toBe(
        true,
      );
      click(el, '保存成本确认版本');
      expect(api.confirm).toHaveBeenCalledTimes(1);
      pending.resolve(header);
      await flush();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
