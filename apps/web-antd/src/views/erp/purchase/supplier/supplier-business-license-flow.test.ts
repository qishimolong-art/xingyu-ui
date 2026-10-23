/* Test doubles for the modal, form adapter and upload widget. */
/* eslint-disable vue/one-component-per-file */
import type { App, Component } from 'vue';

import { createApp, defineComponent, h, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EnterpriseMatch from './modules/enterprise-match-modal.vue';
import SupplierForm from './modules/form.vue';

const state = vi.hoisted(() => ({
  forms: [] as any[],
  modals: [] as any[],
  upload: undefined as any,
  supplier: undefined as any,
  recognize: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  getSupplier: vi.fn(),
  saveBusiness: vi.fn(),
  saveImage: vi.fn(),
  confirm: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  areaTree: vi.fn(),
}));

vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('@vben/icons', () => ({ IconifyIcon: () => null }));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/views/erp/base/modules/form.vue', () => ({ default: () => null }));
vi.mock('#/composables/useFieldPermission', () => ({
  useFieldPermission: () => ({
    hiddenFields: { value: [] },
    loadHiddenFields: async () => {},
  }),
}));
vi.mock('./utils/field-visibility', () => ({
  loadSupplierFieldVisibility: async () => ({
    hiddenFields: [],
    config: [],
    configFieldKeys: [],
    configHiddenFields: [],
  }),
}));
vi.mock('#/views/erp/composables/useFieldConfig', () => ({
  getFieldConfigHiddenFields: async () => [],
  applyEffectiveFieldVisibility: (schema: any) => schema,
}));
vi.mock('./data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./data')>()),
  useBasicFormSchema: () => [],
  useFinanceFormSchema: () => [],
  useInvoiceFormSchema: () => [],
  useSaleFormSchema: () => [],
  useSystemFormSchema: () => [],
}));
vi.mock('#/api/erp/purchase/supplier', () => ({
  recognizeSupplierBusinessLicense: state.recognize,
  createSupplier: state.create,
  updateSupplier: state.update,
  getSupplier: state.getSupplier,
  getSupplierFormDeptPage: async () => ({
    list: [{ id: 1, name: 'Dept' }],
    total: 1,
  }),
}));
vi.mock('#/api/erp/purchase/supplier/business-info', () => ({
  createSupplierBusinessInfo: state.saveBusiness,
}));
vi.mock('#/api/erp/purchase/supplier/image', () => ({
  createSupplierImage: state.saveImage,
}));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { deptId: 1 } }),
}));
vi.mock('#/views/erp/purchase/utils/dept', () => ({
  ensurePurchaseDeptTreeLoaded: async () => {},
}));
vi.mock('#/views/erp/purchase/utils/form-enter-focus', () => ({
  attachPurchaseInputEnterFocus: (schema: any) => schema,
}));
vi.mock('#/api/system/area', () => ({ getAreaTree: state.areaTree }));
vi.mock('#/components/upload/use-upload', () => ({
  useUpload: () => ({
    httpRequest: async () => ({ url: '/test-license.png' }),
  }),
}));
vi.mock('./utils/business-license', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./utils/business-license')>()),
  readSupplierBusinessLicenseFileAsDataUrl: async () =>
    'data:image/png;base64,test',
}));
vi.mock('ant-design-vue', () => {
  const Slot = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  return {
    Alert: Slot,
    Spin: Slot,
    Button: defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('button', slots.default?.()),
    }),
    Descriptions: Object.assign(Slot, { Item: Slot }),
    Upload: Object.assign(
      defineComponent({
        props: {
          beforeUpload: { type: Function, required: true },
          fileList: { type: Array, required: true },
        },
        emits: ['remove', 'preview'],
        setup(props, { emit, slots }) {
          state.upload = { props, remove: () => emit('remove') };
          return () => h('div', slots.default?.());
        },
      }),
      { LIST_IGNORE: 'ignore' },
    ),
    Modal: { confirm: state.confirm },
    message: {
      error: state.error,
      success: state.success,
      info: vi.fn(),
      warning: vi.fn(),
    },
  };
});
vi.mock('@vben/common-ui', () => ({
  useVbenModal: (options: any) => {
    const api = {
      getData: () => state.supplier,
      close: vi.fn(),
      lock: vi.fn(),
      unlock: vi.fn(),
      setState: vi.fn(),
    };
    state.modals.push({ options, api });
    return [
      defineComponent({
        setup:
          (_, { slots }) =>
          () =>
            h('div', slots.default?.()),
      }),
      api,
    ];
  },
}));
vi.mock('#/adapter/form', () => ({
  useVbenForm: (options: any) => {
    const formIndex = state.forms.length;
    const invoiceFields = new Set([
      'invoiceAddress',
      'invoiceBank',
      'invoiceBankAccount',
      'invoiceCompany',
      'invoicePhone',
      'invoiceType',
      'taxpayerId',
    ]);
    const financeFields = new Set([
      'account',
      'bankAccount',
      'bankAddress',
      'bankName',
      'creditCode',
      'financePhone',
      'legalPerson',
      'memberCode',
      'settleLocked',
      'settleMethod',
      'taxNo',
      'taxPercent',
    ]);
    // Match the real adapter's setValues schema filtering across the three forms.
    const accepts = (key: string) => {
      if (formIndex === 1) return invoiceFields.has(key);
      if (formIndex === 2) return financeFields.has(key);
      return !invoiceFields.has(key) && !financeFields.has(key);
    };
    const api = {
      values: {} as Record<string, any>,
      getValues: async () => ({ ...api.values }),
      setValues: async (values: any) => {
        Object.assign(
          api.values,
          Object.fromEntries(
            Object.entries(values).filter(([key]) => accepts(key)),
          ),
        );
      },
      setFieldValue: async (key: string, value: any) => {
        api.values[key] = value;
      },
      resetForm: async () => {
        api.values = {};
      },
      setState: vi.fn(),
      validate: async () => ({ valid: true }),
      getFocusedField: () => undefined,
    };
    state.forms.push({ api, options });
    return [() => null, api];
  },
}));

const address = '浙江省杭州市滨江区长河街道测试路18号201室';
let app: App;
let root: HTMLDivElement;
let onSuccess: ReturnType<typeof vi.fn>;

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

async function mount(component: Component) {
  root = document.createElement('div');
  document.body.append(root);
  onSuccess = vi.fn();
  app = createApp(component, { onSuccess });
  app.mount(root);
  await state.modals[0].options.onOpenChange(true);
  await nextTick();
}

async function uploadAndRecognize() {
  state.upload.props.beforeUpload(new File(['image'], 'license.png'));
  await nextTick();
  const button = [...root.querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === '识别',
  );
  expect(button).toBeDefined();
  button?.click();
  await settle();
}

beforeEach(() => {
  vi.resetAllMocks();
  state.forms = [];
  state.modals = [];
  state.supplier = undefined;
  state.recognize.mockResolvedValue({
    success: true,
    invoiceCompany: '杭州测试有限公司',
    invoiceAddress: address,
  });
  state.areaTree.mockResolvedValue([]);
  state.create.mockResolvedValue(123);
  state.saveBusiness.mockResolvedValue(1);
  state.saveImage.mockResolvedValue(1);
});
afterEach(() => {
  app?.unmount();
  root?.remove();
});

describe('supplier business license UI flow', () => {
  it('blocks saving when a form section fails to hydrate on reopening', async () => {
    await mount(SupplierForm);
    await state.modals[0].options.onOpenChange(false);
    state.forms[1].api.setValues = vi
      .fn()
      .mockRejectedValue(new Error('Form unavailable'));
    await state.modals[0].options.onOpenChange(true);
    expect(state.modals[0].api.setState).toHaveBeenLastCalledWith({
      fullscreen: true,
      confirmDisabled: true,
    });
    await state.modals[0].options.onConfirm();
    expect(state.create).not.toHaveBeenCalled();
    expect(state.update).not.toHaveBeenCalled();
  });
  it('fills complete residence despite area failure, then saves it with OCR artifacts', async () => {
    state.areaTree.mockRejectedValueOnce(new Error('area unavailable'));
    await mount(SupplierForm);
    await uploadAndRecognize();
    expect(state.forms[0].api.values).toMatchObject({
      name: '杭州测试有限公司',
      address,
    });
    expect(state.forms[1].api.values.invoiceAddress).toBe(address);
    expect(state.forms[0].api.values.pinyinCode).toBeTruthy();
    expect(state.success).toHaveBeenCalledWith(
      expect.stringContaining('已填充 5 项'),
    );
    await state.modals[0].options.onConfirm();
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({ address }),
    );
    expect(state.saveBusiness).toHaveBeenCalledWith(
      expect.objectContaining({ supplierId: 123 }),
    );
    expect(state.saveImage).toHaveBeenCalledWith(
      expect.objectContaining({ supplierId: 123 }),
    );
    expect(onSuccess).toHaveBeenCalledWith({ id: 123, targetTab: 'business' });
    expect(state.confirm).not.toHaveBeenCalled();
  });

  it('waits for confirmation in create form before filling and saving, preserving the name', async () => {
    await mount(SupplierForm);
    state.forms[0].api.values = { name: '原供应商', areaIds: ['浙江省'] };
    await uploadAndRecognize();
    expect(state.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        okText: '继续填充',
        content: expect.stringContaining('当前供应商名称：原供应商'),
      }),
    );
    expect(state.forms[0].api.values.address).toBeUndefined();
    expect(state.forms[1].api.values.invoiceAddress).toBeUndefined();
    await state.modals[0].options.onConfirm();
    expect(state.create).not.toHaveBeenCalled();
    state.confirm.mock.calls[0]?.[0].onOk();
    await settle();
    expect(state.forms[0].api.values).toMatchObject({
      name: '原供应商',
      areaIds: ['浙江省'],
      address,
    });
    await state.modals[0].options.onConfirm();
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: '原供应商', address }),
    );
  });

  it('waits for enterprise match confirmation before saving, refreshing and closing', async () => {
    state.supplier = { id: 123, name: '原供应商' };
    await mount(EnterpriseMatch);
    state.upload.props.beforeUpload(new File(['image'], 'license.png'));
    const pending = state.modals[0].options.onConfirm();
    await settle();
    expect(state.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        okText: '继续保存',
        content: expect.stringContaining('营业执照名称：杭州测试有限公司'),
      }),
    );
    expect(state.saveBusiness).not.toHaveBeenCalled();
    expect(state.saveImage).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(state.modals[0].api.close).not.toHaveBeenCalled();
    state.confirm.mock.calls[0]?.[0].onOk();
    await pending;
    expect(state.saveBusiness).toHaveBeenCalledTimes(1);
    expect(state.saveImage).toHaveBeenCalledTimes(1);
    expect(state.update).not.toHaveBeenCalled();
    expect(state.supplier.name).toBe('原供应商');
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(state.modals[0].api.close).toHaveBeenCalledOnce();
  });

  it('does not fill or show a mismatch when OCR reports failure', async () => {
    state.recognize.mockResolvedValueOnce({
      success: false,
      message: '图片不清晰',
      invoiceCompany: '错误结果',
    });
    await mount(SupplierForm);
    state.forms[0].api.values.name = '原供应商';
    await uploadAndRecognize();
    expect(state.forms[0].api.values.address).toBeUndefined();
    expect(state.confirm).not.toHaveBeenCalled();
    expect(state.error).toHaveBeenCalledWith('图片不清晰');
  });

  it('keeps manual edits through repeat recognition and clears upload state on reopening', async () => {
    await mount(SupplierForm);
    await uploadAndRecognize();
    state.forms[0].api.values.address = '人工修正地址';
    await uploadAndRecognize();
    expect(state.forms[0].api.values.address).toBe('人工修正地址');
    state.upload.remove();
    await nextTick();
    expect(state.upload.props.fileList).toEqual([]);
    await state.modals[0].options.onOpenChange(false);
    await state.modals[0].options.onOpenChange(true);
    expect(state.forms[0].api.values.address).toBeUndefined();
    expect(state.upload.props.fileList).toEqual([]);
  });

  it.each(['onCancel', 'afterClose'])(
    'does not persist rejected create-page artifacts after %s',
    async (action) => {
      await mount(SupplierForm);
      state.forms[0].api.values.name = '原供应商';
      await uploadAndRecognize();
      state.confirm.mock.calls[0]?.[0][action]();
      await settle();
      expect(state.forms[0].api.values.address).toBeUndefined();
      expect(state.forms[1].api.values.invoiceCompany).toBeUndefined();
      expect(state.areaTree).not.toHaveBeenCalled();
      await state.modals[0].options.onConfirm();
      expect(state.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: '原供应商' }),
      );
      expect(state.saveBusiness).not.toHaveBeenCalled();
      expect(state.saveImage).not.toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith(123);
    },
  );

  it('allows retry after cancelling enterprise match and only saves after confirmation', async () => {
    state.supplier = { id: 123, name: '原供应商' };
    await mount(EnterpriseMatch);
    state.upload.props.beforeUpload(new File(['image'], 'license.png'));
    const cancelled = state.modals[0].options.onConfirm();
    await settle();
    state.confirm.mock.calls[0]?.[0].onCancel();
    await cancelled;
    expect(state.saveBusiness).not.toHaveBeenCalled();
    expect(state.saveImage).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(state.modals[0].api.close).not.toHaveBeenCalled();
    const confirmed = state.modals[0].options.onConfirm();
    await settle();
    state.confirm.mock.calls[1]?.[0].onOk();
    await confirmed;
    expect(state.saveBusiness).toHaveBeenCalledOnce();
    expect(state.saveImage).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('does not apply a confirmation after the create form closes', async () => {
    await mount(SupplierForm);
    state.forms[0].api.values.name = '原供应商';
    await uploadAndRecognize();
    await state.modals[0].options.onOpenChange(false);
    await state.modals[0].options.onOpenChange(true);
    state.confirm.mock.calls[0]?.[0].onOk();
    await settle();
    expect(state.forms[0].api.values.address).toBeUndefined();
    expect(state.saveBusiness).not.toHaveBeenCalled();
  });

  it('continues without confirmation when enterprise names match after trimming', async () => {
    state.supplier = { id: 123, name: ' 杭州测试有限公司 ' };
    await mount(EnterpriseMatch);
    state.upload.props.beforeUpload(new File(['image'], 'license.png'));
    await state.modals[0].options.onConfirm();
    expect(state.confirm).not.toHaveBeenCalled();
    expect(state.saveBusiness).toHaveBeenCalledOnce();
    expect(state.saveImage).toHaveBeenCalledOnce();
  });
});

const areaTree = [
  {
    id: 33,
    name: '浙江省',
    children: [
      { id: 3301, name: '杭州市', children: [{ id: 330_108, name: '滨江区' }] },
    ],
  },
];
function deferred<T = any>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function recognizeAgain() {
  [...root.querySelectorAll('button')]
    .find((button) => button.textContent?.trim() === '识别')
    ?.click();
}

describe('supplier OCR async lifecycle and address preservation', () => {
  it('preserves manual address and matches areas independently, including repeated recognition', async () => {
    state.areaTree.mockResolvedValue(areaTree);
    await mount(SupplierForm);
    state.forms[0].api.values.address = '人工地址';
    await uploadAndRecognize();
    expect(state.forms[0].api.values).toMatchObject({
      address: '人工地址',
      areaIds: ['浙江省', '杭州市', '滨江区'],
    });
    recognizeAgain();
    await settle();
    expect(state.confirm).not.toHaveBeenCalled();
    expect(state.areaTree).toHaveBeenCalledOnce();
    expect(state.forms[0].api.values.address).toBe('人工地址');
    await state.modals[0].options.onConfirm();
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '人工地址',
        province: '浙江省',
        city: '杭州市',
        district: '滨江区',
      }),
    );
  });

  it('preserves manual changes made while area matching is pending', async () => {
    const area = deferred();
    state.areaTree.mockReturnValueOnce(area.promise);
    await mount(SupplierForm);
    await uploadAndRecognize();
    state.forms[0].api.values.address = '人工地址';
    area.resolve(areaTree);
    await settle();
    expect(state.forms[0].api.values.address).toBe('人工地址');
  });

  it.each([SupplierForm, EnterpriseMatch])(
    'ignores old confirmation without unlocking a newer request after reopening',
    async (component) => {
      state.supplier = { id: 123, name: '原供应商' };
      await mount(component);
      if (component === SupplierForm) {
        state.forms[0].api.values.name = '原供应商';
        await uploadAndRecognize();
      } else {
        state.upload.props.beforeUpload(new File(['image'], 'license.png'));
        void state.modals[0].options.onConfirm();
        await settle();
      }
      const oldConfirm = state.confirm.mock.calls[0]?.[0];
      await state.modals[0].options.onOpenChange(false);
      await state.modals[0].options.onOpenChange(true);
      const newer = deferred();
      state.recognize.mockReturnValueOnce(newer.promise);
      if (component === SupplierForm) await uploadAndRecognize();
      else {
        state.upload.props.beforeUpload(new File(['image'], 'new.png'));
        void state.modals[0].options.onConfirm();
        await settle();
      }
      oldConfirm.onOk();
      await settle();
      if (component === SupplierForm) recognizeAgain();
      await state.modals[0].options.onConfirm();
      expect(state.recognize).toHaveBeenCalledTimes(2);
      expect(state.create).not.toHaveBeenCalled();
      expect(state.saveBusiness).not.toHaveBeenCalled();
      expect(state.saveImage).not.toHaveBeenCalled();
      newer.resolve({ success: false, message: 'test failure' });
      await settle();
    },
  );

  it.each(['replace', 'remove', 'reopen'])(
    'discards an old response after %s',
    async (action) => {
      const pending = deferred();
      state.recognize.mockReturnValueOnce(pending.promise);
      await mount(SupplierForm);
      await uploadAndRecognize();
      if (action === 'replace')
        state.upload.props.beforeUpload(new File(['new'], 'new.png'));
      if (action === 'remove') state.upload.remove();
      if (action === 'reopen') {
        await state.modals[0].options.onOpenChange(false);
        await state.modals[0].options.onOpenChange(true);
      }
      pending.resolve({
        success: true,
        invoiceAddress: address,
        invoiceCompany: '旧结果',
      });
      await settle();
      expect(state.forms[0].api.values.address).toBeUndefined();
      expect(state.forms[0].api.values.name).toBeUndefined();
      expect(state.confirm).not.toHaveBeenCalled();
    },
  );

  it.each(['replace', 'remove', 'reopen'])(
    'does not save an obsolete enterprise confirmation after %s',
    async (action) => {
      state.supplier = { id: 123, name: '原供应商' };
      await mount(EnterpriseMatch);
      state.upload.props.beforeUpload(new File(['image'], 'license.png'));
      const pending = state.modals[0].options.onConfirm();
      await settle();
      if (action === 'replace')
        state.upload.props.beforeUpload(new File(['new'], 'new.png'));
      if (action === 'remove') state.upload.remove();
      if (action === 'reopen') {
        await state.modals[0].options.onOpenChange(false);
        await state.modals[0].options.onOpenChange(true);
      }
      state.confirm.mock.calls[0]?.[0].onOk();
      await pending;
      expect(state.saveBusiness).not.toHaveBeenCalled();
      expect(state.saveImage).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    },
  );

  it('does not fill after closing while region matching is pending', async () => {
    const pending = deferred();
    state.areaTree.mockReturnValueOnce(pending.promise);
    await mount(SupplierForm);
    await uploadAndRecognize();
    await state.modals[0].options.onOpenChange(false);
    await state.modals[0].options.onOpenChange(true);
    pending.resolve(areaTree);
    await settle();
    expect(state.forms[0].api.values.address).toBeUndefined();
  });

  it.each([SupplierForm, EnterpriseMatch])(
    'continues with the original name when OCR has no name',
    async (component) => {
      state.supplier = { id: 123, name: '原供应商' };
      state.recognize.mockResolvedValue({
        success: true,
        invoiceAddress: address,
      });
      await mount(component);
      if (component === SupplierForm) {
        state.forms[0].api.values.name = '原供应商';
        await uploadAndRecognize();
        expect(state.forms[0].api.values).toMatchObject({
          name: '原供应商',
          address,
        });
      } else {
        state.upload.props.beforeUpload(new File(['image'], 'license.png'));
        await state.modals[0].options.onConfirm();
        expect(state.saveBusiness).toHaveBeenCalledOnce();
      }
      expect(state.confirm).not.toHaveBeenCalled();
    },
  );
});

describe('supplier OCR retry and submit guards', () => {
  it('prevents duplicate recognition and submit until confirmation finishes', async () => {
    await mount(SupplierForm);
    state.forms[0].api.values.name = '原供应商';
    await uploadAndRecognize();
    recognizeAgain();
    await state.modals[0].options.onConfirm();
    expect(state.recognize).toHaveBeenCalledOnce();
    expect(state.create).not.toHaveBeenCalled();
    state.confirm.mock.calls[0]?.[0].onCancel();
    await settle();
    recognizeAgain();
    await settle();
    state.confirm.mock.calls[1]?.[0].onOk();
    await settle();
    await state.modals[0].options.onConfirm();
    expect(state.saveBusiness).toHaveBeenCalledOnce();
    expect(state.saveImage).toHaveBeenCalledOnce();
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: '原供应商', address }),
    );
  });
  it('prevents duplicate enterprise saves while confirmation is pending', async () => {
    state.supplier = { id: 123, name: '原供应商' };
    await mount(EnterpriseMatch);
    state.upload.props.beforeUpload(new File(['image'], 'license.png'));
    const pending = state.modals[0].options.onConfirm();
    await settle();
    await state.modals[0].options.onConfirm();
    expect(state.recognize).toHaveBeenCalledOnce();
    state.confirm.mock.calls[0]?.[0].onOk();
    await pending;
    expect(state.saveBusiness).toHaveBeenCalledOnce();
    expect(state.saveImage).toHaveBeenCalledOnce();
  });
  it('reports enterprise recognition failure without a success event or saved artifacts', async () => {
    state.supplier = { id: 123, name: '原供应商' };
    state.recognize.mockResolvedValueOnce({
      success: false,
      message: '图片不清晰',
    });
    await mount(EnterpriseMatch);
    state.upload.props.beforeUpload(new File(['image'], 'license.png'));
    await state.modals[0].options.onConfirm();
    expect(state.error).toHaveBeenCalledWith('图片不清晰');
    expect(state.saveBusiness).not.toHaveBeenCalled();
    expect(state.saveImage).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
