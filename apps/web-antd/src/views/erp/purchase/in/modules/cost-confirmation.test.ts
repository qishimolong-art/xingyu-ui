import type { PurchaseCostApi } from '#/api/erp/purchase/cost-confirmation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, reactive } from 'vue';

const api = vi.hoisted(() => ({
  permissions: new Set<string>(),
  preview: vi.fn(),
  confirmation: vi.fn(),
  items: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.every((code) => api.permissions.has(code)),
  }),
}));
vi.mock('#/api/erp/purchase/cost-confirmation', () => ({
  getPurchaseCostPreview: api.preview,
  getPurchaseCostConfirmation: api.confirmation,
  getPurchaseCostItems: api.items,
  confirmPurchaseCost: api.confirm,
}));
vi.mock('ant-design-vue', () => {
  const box = defineComponent({
    props: ['message'],
    setup:
      (props, { slots }) =>
      () =>
        h('div', [props.message, slots.default?.()]),
  });
  const input = defineComponent({
    inheritAttrs: false,
    props: ['value'],
    emits: ['update:value'],
    setup:
      (props, { emit, attrs }) =>
      () =>
        h('input', {
          ...attrs,
          value: props.value ?? '',
          onInput: (event: Event) =>
            emit('update:value', (event.target as HTMLInputElement).value),
        }),
  });
  const button = defineComponent({
    props: ['disabled', 'loading'],
    setup:
      (props, { attrs, slots }) =>
      () =>
        h(
          'button',
          { ...attrs, disabled: props.disabled || props.loading },
          slots.default?.(),
        ),
  });
  const table = defineComponent({
    props: ['dataSource', 'columns'],
    emits: ['change'],
    setup:
      (props, { emit, slots }) =>
      () =>
        h('div', [
          ...(props.dataSource || []).map((record: Record<string, unknown>) =>
            h(
              'div',
              (props.columns || []).map((column: { dataIndex: string }) =>
                h(
                  'span',
                  slots.bodyCell?.({ record, column }) ||
                    String(record[column.dataIndex] ?? ''),
                ),
              ),
            ),
          ),
          h(
            'button',
            {
              onClick: () =>
                emit('change', { current: 2, pageSize: 20 }, {}, {}),
            },
            '下一页',
          ),
        ]),
  });
  const modal = defineComponent({
    props: ['confirmLoading', 'okButtonProps'],
    emits: ['ok', 'cancel'],
    setup:
      (props, { emit, slots }) =>
      () =>
        h('div', [
          slots.default?.(),
          h(
            'button',
            {
              disabled: props.confirmLoading || props.okButtonProps?.disabled,
              onClick: () => emit('ok'),
            },
            '确认全部明细成本',
          ),
          h('button', { onClick: () => emit('cancel') }, '关闭确认'),
        ]),
  });
  return {
    Alert: box,
    Button: button,
    Tag: box,
    Table: table,
    Input: Object.assign(input, { TextArea: input }),
    InputNumber: input,
    Modal: modal,
  };
});
import CostForm from './cost-confirmation-form.vue';
import CostTab from './cost-confirmation-tab.vue';
import {
  costText,
  loadCompleteCostItems,
  validateCostConfirmation,
} from './cost-confirmation';

const header: PurchaseCostApi.Header = {
  purchaseInId: 1,
  purchaseNo: 'PI001',
  sourceSignature: 'sig-1',
  latestRevision: 0,
  sourceItemCount: 2,
  status: 'NONE',
  priceBasis: 'INCLUSIVE_UNCONFIRMED',
  taxStatus: 'UNKNOWN',
  costMasked: false,
  canConfirm: true,
};
const item = (id: number): PurchaseCostApi.Item => ({
  sourceSignature: 'sig-1',
  sourceItemId: id,
  productId: id,
  productName: `配件${id}`,
  warehouseId: 3,
  quantity: '1',
  rawLineAmount: '9007199254740993.123456',
});
const cleanups: Array<() => void> = [];
function mount(component: Parameters<typeof createApp>[0], props = {}) {
  const element = document.createElement('div');
  document.body.append(element);
  const app = createApp(component, props);
  app.mount(element);
  cleanups.push(() => {
    app.unmount();
    element.remove();
  });
  return element;
}
async function flush() {
  for (let index = 0; index < 8; index++) {
    await Promise.resolve();
    await nextTick();
  }
}
function click(element: HTMLElement, label: string) {
  const button = [...element.querySelectorAll('button')].find(
    (node) => node.textContent === label,
  );
  if (!button) throw new Error(`missing ${label}`);
  button.click();
}
async function input(element: HTMLElement, label: string, value: string) {
  const field = element.querySelector(
    `[aria-label="${label}"]`,
  ) as HTMLInputElement;
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
}
beforeEach(() => {
  vi.clearAllMocks();
  api.permissions.clear();
  api.permissions.add('erp:purchase-cost-confirmation:query');
  api.permissions.add('erp:purchase-cost-confirmation:confirm');
  api.preview.mockResolvedValue({ ...header });
  api.confirmation.mockResolvedValue({ ...header });
  api.items.mockImplementation((_id: number, signature: string) =>
    Promise.resolve({
      list: [item(1), item(2)].map((row) => ({
        ...row,
        sourceSignature: signature,
      })),
      total: 2,
    }),
  );
  api.confirm.mockResolvedValue({
    ...header,
    status: 'CONFIRMED',
    latestRevision: 1,
    confirmationId: 10,
    canConfirm: false,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

describe('采购来源成本确认', () => {
  it('未消费确认可追加新版本，旧金额仅展示且新依据需明确填写', async () => {
    const confirmed = {
      ...header,
      status: 'CONFIRMED' as const,
      latestRevision: 1,
      canConfirm: true,
    };
    api.preview.mockResolvedValue(confirmed);
    api.confirmation.mockResolvedValue(confirmed);
    api.items.mockResolvedValue({
      list: [{ ...item(1), confirmedNetTotalAmount: '123.456' }, item(2)],
      total: 2,
    });
    const root = mount(CostTab, { active: true, purchaseInId: 1 });
    await flush();
    click(root, '重新确认成本（新版本）');
    await flush();
    expect(root.textContent).toContain('生成新版本并保留旧版本');
    expect(root.textContent).toContain('123.46');
    expect(
      (root.querySelector('[aria-label="未税成本-1"]') as HTMLInputElement)
        .value,
    ).toBe('');
    await input(root, '未税成本-1', '124');
    await input(root, '未税成本-2', '20');
    await input(root, '核对依据', '复核更正，原凭据附件2');
    await input(root, '费用及折扣处理', '无其他分摊');
    click(root, '确认全部明细成本');
    await flush();
    expect(api.confirm.mock.calls[0]?.[0]).toMatchObject({
      expectedRevision: 1,
      expectedSignature: 'sig-1',
      evidence: '复核更正，原凭据附件2',
    });
  });
  it('已消费版本即使错误携带可确认标志也不得再次确认', async () => {
    const consumed = {
      ...header,
      status: 'CONSUMED' as const,
      latestRevision: 1,
      canConfirm: true,
    };
    api.preview.mockResolvedValue(consumed);
    api.confirmation.mockResolvedValue(consumed);
    const root = mount(CostTab, { active: true, purchaseInId: 1 });
    await flush();
    expect(root.textContent).not.toContain('重新确认成本');
    expect(root.textContent).not.toContain('确认未税成本');
    mount(CostForm, { header: consumed });
    await flush();
    expect(api.confirm).not.toHaveBeenCalled();
  });
  it('内网环境没有crypto.randomUUID仍可打开表单', async () => {
    vi.stubGlobal('crypto', undefined);
    const root = mount(CostForm, { header });
    await flush();
    expect(root.querySelector('[aria-label="未税成本-1"]')).not.toBeNull();
  });
  it('后端禁止历史已审核来源确认时不提供入口', async () => {
    api.preview.mockResolvedValue({
      ...header,
      canConfirm: false,
      sourceStatus: 20,
      confirmBlockedReason: '已审核历史单只读',
    });
    api.confirmation.mockResolvedValue({
      ...header,
      canConfirm: false,
      sourceStatus: 20,
      confirmBlockedReason: '已审核历史单只读',
    });
    const root = mount(CostTab, { active: true, purchaseInId: 1 });
    await flush();
    expect(root.textContent).toContain('已审核历史单只读');
    expect(root.textContent).not.toContain('确认未税成本');
  });
  it('金额展示两位小数且不丢失大整数位，未知金额不显示零', () => {
    expect(costText('9007199254740993.123456')).toBe('9007199254740993.12');
    expect(costText(null)).toBe('不可用');
    expect(costText('123', true)).toBe('****');
    expect(validateCostConfirmation([item(1)], '依据', '无费用')).toContain(
      '每条明细',
    );
  });
  it('完整读取多页来源且每页绑定签名，重复或变更中止', async () => {
    api.items
      .mockResolvedValueOnce({ total: 2, list: [item(1)] })
      .mockResolvedValueOnce({ total: 2, list: [item(2)] });
    expect(await loadCompleteCostItems(header)).toHaveLength(2);
    expect(api.items).toHaveBeenNthCalledWith(2, 1, 'sig-1', 2, 100);
    api.items.mockResolvedValueOnce({ total: 2, list: [item(1), item(1)] });
    await expect(loadCompleteCostItems(header)).rejects.toThrow('重复');
    api.items.mockResolvedValueOnce({ total: 3, list: [item(1)] });
    await expect(loadCompleteCostItems(header)).rejects.toThrow('变更');
  });
  it('没有独立查询权限不请求，确认权限不能替代查询', async () => {
    api.permissions.delete('erp:purchase-cost-confirmation:query');
    const root = mount(CostTab, { active: true, purchaseInId: 1 });
    await flush();
    expect(api.preview).not.toHaveBeenCalled();
    expect(root.textContent).toContain('没有采购核算成本查询权限');
    mount(CostForm, { header });
    await flush();
    expect(api.items).not.toHaveBeenCalled();
  });
  it('未激活/未保存不请求，分页带来源签名；query-only无确认按钮', async () => {
    const state = reactive({
      active: false,
      purchaseInId: undefined as number | undefined,
    });
    const root = mount(
      defineComponent({ setup: () => () => h(CostTab, state) }),
    );
    await flush();
    expect(api.preview).not.toHaveBeenCalled();
    api.permissions.delete('erp:purchase-cost-confirmation:confirm');
    state.active = true;
    state.purchaseInId = 1;
    await flush();
    expect(root.textContent).not.toContain('确认未税成本');
    click(root, '下一页');
    await flush();
    expect(api.items).toHaveBeenLastCalledWith(1, 'sig-1', 2, 20);
  });
  it('遮罩隐藏金额和可能含金额的依据，并禁止确认', async () => {
    api.preview.mockResolvedValue({ ...header, costMasked: true });
    api.confirmation.mockResolvedValue({
      ...header,
      evidence: '保密金额999',
      feeTreatment: '保密运费888',
    });
    const root = mount(CostTab, { active: true, purchaseInId: 1 });
    await flush();
    expect(root.textContent).not.toContain('9007199254740993');
    expect(root.textContent).not.toContain('保密');
    expect(root.textContent).toContain('****');
    expect(root.textContent).not.toContain('确认未税成本');
  });
  it('旧异步请求不覆盖新来源，版本不一致显示原因', async () => {
    let resolveOld!: (value: PurchaseCostApi.Header) => void;
    api.preview.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const state = reactive({ active: true, purchaseInId: 1 });
    const root = mount(
      defineComponent({ setup: () => () => h(CostTab, state) }),
    );
    await flush();
    state.purchaseInId = 2;
    api.preview.mockResolvedValue({
      ...header,
      purchaseInId: 2,
      sourceSignature: 'sig-2',
    });
    api.confirmation.mockResolvedValue({
      ...header,
      purchaseInId: 2,
      sourceSignature: 'sig-2',
    });
    await flush();
    resolveOld(header);
    await flush();
    expect(api.items).toHaveBeenCalledTimes(1);
    expect(api.items).toHaveBeenCalledWith(2, 'sig-2', 1, 20);
    api.confirmation.mockResolvedValue({
      ...header,
      sourceSignature: 'different',
    });
    click(root, '刷新核算状态');
    await flush();
    expect(root.textContent).toContain('来源版本已变化');
  });
  it('输入初始空白，完整精确提交、防连击、失败保留且成功刷新', async () => {
    const success = vi.fn();
    const close = vi.fn();
    const root = mount(CostForm, {
      header,
      onSuccess: success,
      onClose: close,
    });
    await flush();
    expect(
      (root.querySelector('[aria-label="未税成本-1"]') as HTMLInputElement)
        .value,
    ).toBe('');
    click(root, '确认全部明细成本');
    await flush();
    expect(api.confirm).not.toHaveBeenCalled();
    await input(root, '未税成本-1', '9007199254740993.123456');
    await input(root, '未税成本-2', '0');
    await input(root, '核对依据', '按原始凭据核对');
    await input(root, '费用及折扣处理', '无折扣费用，赠品成本明确为0');
    let reject!: (reason: Error) => void;
    api.confirm.mockImplementationOnce(
      () =>
        new Promise((_, rejectFn) => {
          reject = rejectFn;
        }),
    );
    click(root, '确认全部明细成本');
    await flush();
    click(root, '确认全部明细成本');
    expect(api.confirm).toHaveBeenCalledTimes(1);
    expect(api.confirm.mock.calls[0]?.[0].items).toEqual([
      {
        sourceItemId: 1,
        confirmedNetTotalAmount: '9007199254740993.123456',
        evidence: '按原始凭据核对',
      },
      {
        sourceItemId: 2,
        confirmedNetTotalAmount: '0',
        evidence: '按原始凭据核对',
      },
    ]);
    expect(
      (root.querySelector('[aria-label="未税成本-1"]') as HTMLInputElement)
        .disabled,
    ).toBe(true);
    reject(new Error('网络超时'));
    await flush();
    expect(root.textContent).toContain('网络超时');
    expect(
      (root.querySelector('[aria-label="未税成本-1"]') as HTMLInputElement)
        .value,
    ).toBe('9007199254740993.123456');
    expect(close).not.toHaveBeenCalled();
    // 服务端可能已成功但响应丢失；相同请求重试使用原标识获取幂等结果。
    api.preview.mockResolvedValue({
      ...header,
      status: 'CONFIRMED',
      latestRevision: 1,
    });
    click(root, '确认全部明细成本');
    await flush();
    expect(api.confirm.mock.calls[1]?.[0].requestKey).toBe(
      api.confirm.mock.calls[0]?.[0].requestKey,
    );
    expect(success).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
  it('原单修改使确认失效，保留已填写值但拒绝提交旧版本', async () => {
    const root = mount(CostForm, { header });
    await flush();
    await input(root, '未税成本-1', '10');
    await input(root, '未税成本-2', '20');
    await input(root, '核对依据', '凭证');
    await input(root, '费用及折扣处理', '无');
    api.preview.mockResolvedValue({ ...header, sourceSignature: 'new' });
    click(root, '确认全部明细成本');
    await flush();
    expect(api.confirm).not.toHaveBeenCalled();
    expect(root.textContent).toContain('来源或确认版本已变化');
    expect(
      (root.querySelector('[aria-label="未税成本-1"]') as HTMLInputElement)
        .value,
    ).toBe('10');
  });
});
