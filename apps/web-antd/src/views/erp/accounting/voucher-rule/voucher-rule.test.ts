import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  previewVouchers: vi.fn(),
  generatePreview: vi.fn(),
  getAuxiliaryOptions: vi.fn(),
}));
vi.mock('#/api/erp/finance/accounting/voucher-rule', () => ({
  ...api,
  STATUS_LABELS: { READY: '可生成', MANUAL: '需人工处理' },
  AUX_LABELS: { supplier: '供应商', dept: '部门', project: '项目' },
}));
vi.mock('ant-design-vue', () => {
  const stub = (name: string) =>
    defineComponent({
      name,
      props: [
        'modelValue',
        'value',
        'checked',
        'open',
        'disabled',
        'options',
        'dataSource',
      ],
      emits: ['ok', 'change', 'dropdownVisibleChange'],
      setup(_, { slots, emit }) {
        return () =>
          h('div', [
            slots.default?.(),
            name === 'Modal'
              ? h(
                  'button',
                  { 'data-ok': 'true', onClick: () => emit('ok') },
                  '确定',
                )
              : null,
          ]);
      },
    });
  return {
    Alert: stub('Alert'),
    Checkbox: stub('Checkbox'),
    Table: stub('Table'),
    Tag: stub('Tag'),
    Modal: stub('Modal'),
    Button: stub('Button'),
    Select: stub('Select'),
    message: { success: vi.fn(), warning: vi.fn() },
  };
});
import PreviewModal from './preview-modal.vue';
import AuxiliaryEditor from './auxiliary-editor.vue';
function mount(
  component: any,
  options: { props?: Record<string, unknown> } = {},
) {
  const host = document.createElement('div');
  document.body.append(host);
  const generated: unknown[][] = [];
  const app = createApp(component, {
    ...options.props,
    onGenerated: (...args: unknown[]) => generated.push(args),
  });
  const vm = app.mount(host) as any;
  return {
    vm,
    text: () => host.textContent,
    ok: () => host.querySelector<HTMLButtonElement>('[data-ok]')!.click(),
    emitted: () => generated,
    unmount: () => {
      app.unmount();
      host.remove();
    },
  };
}
async function flushPromises() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await nextTick();
}
describe('凭证预览提交', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.generatePreview.mockResolvedValue([100]);
  });
  it('只提交可生成行，并携带服务端预览版本；失败行不能混入批次', async () => {
    api.previewVouchers.mockResolvedValue([
      {
        bizType: 6,
        bizId: 1,
        bizNo: 'SK1',
        status: 'READY',
        issues: [],
        items: [],
        evidence: {},
        previewToken: 'version-a',
        voucherDate: '2026-09-09',
      },
      {
        bizType: 8,
        bizId: 2,
        bizNo: 'RK2',
        status: 'MANUAL',
        issues: ['库存差额'],
        items: [],
        evidence: {},
      },
    ]);
    const w = mount(PreviewModal);
    await w.vm.show([
      { bizType: 6, bizId: 1 },
      { bizType: 8, bizId: 2 },
    ]);
    await flushPromises();
    w.ok();
    await flushPromises();
    expect(api.generatePreview).toHaveBeenCalledWith([
      {
        bizType: 6,
        bizId: 1,
        voucherDate: '2026-09-09',
        previewToken: 'version-a',
      },
    ]);
    expect(w.emitted()).toHaveLength(1);
    w.unmount();
  });
  it('全部有问题时不会调用生成接口', async () => {
    api.previewVouchers.mockResolvedValue([
      {
        bizType: 8,
        bizId: 2,
        status: 'MANUAL',
        issues: ['未配置'],
        items: [],
        evidence: {},
      },
    ]);
    const w = mount(PreviewModal);
    await w.vm.show([{ bizType: 8, bizId: 2 }]);
    w.ok();
    await flushPromises();
    expect(api.generatePreview).not.toHaveBeenCalled();
    w.unmount();
  });
});
describe('辅助核算编辑', () => {
  it('历史名称缺少ID时保留只读显示', () => {
    const w = mount(AuxiliaryEditor, {
      props: { disabled: true, legacyName: '历史供应商' },
    });
    expect(w.text()).toContain('历史供应商');
    w.unmount();
  });
  it('多维度同时展示，名称不丢失', () => {
    const w = mount(AuxiliaryEditor, {
      props: {
        disabled: true,
        modelValue: [
          { type: 'supplier', id: 1, name: '甲' },
          { type: 'dept', id: 2, name: '总部' },
          { type: 'project', id: 3, name: '项目A' },
        ],
      },
    });
    expect(w.text()).toContain('供应商：甲 / 部门：总部 / 项目：项目A');
    w.unmount();
  });
});
describe('所有受影响Vue组件能编译', () => {
  for (const name of [
    'index.vue',
    'context-form.vue',
    'preview-modal.vue',
    'auxiliary-editor.vue',
    'generation-evidence.vue',
    '../voucher-attribution/index.vue',
    '../voucher/modules/item-form.vue',
    '../voucher/modules/form.vue',
  ])
    it(name, () => {
      const filename = fileURLToPath(new URL(name, import.meta.url));
      const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), {
        filename,
      });
      expect(errors).toEqual([]);
      const script = compileScript(descriptor, { id: name });
      const template = compileTemplate({
        source: descriptor.template!.content,
        filename,
        id: name,
        compilerOptions: { bindingMetadata: script.bindings },
      });
      expect(template.errors).toEqual([]);
    });
});
