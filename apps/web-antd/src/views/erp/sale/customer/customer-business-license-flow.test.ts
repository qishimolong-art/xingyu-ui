/* Test doubles for the modal, form adapter and upload widget. */
/* eslint-disable vue/one-component-per-file */
import type { App, Component } from 'vue';

import { createApp, defineComponent, h, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EnterpriseMatch from './modules/enterprise-match-modal.vue';
import CustomerForm from './modules/form.vue';

const state = vi.hoisted(() => ({
  forms: [] as any[],
  modals: [] as any[],
  upload: undefined as any,
  customer: undefined as any,
  recognize: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  getCustomer: vi.fn(),
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
vi.mock('./utils/field-visibility', () => ({
  loadCustomerFieldVisibility: async () => ({
    config: [],
    hiddenFields: [],
    configHiddenFields: [],
  }),
}));
vi.mock('#/composables/useFieldPermission', () => ({
  useFieldPermission: () => ({
    hiddenFields: { value: [] },
    loadHiddenFields: async () => {},
  }),
}));
vi.mock('#/views/erp/composables/useFieldConfig', () => ({
  getFieldConfigHiddenFields: async () => [],
  applyEffectiveFieldVisibility: (schema: any) => schema,
}));
vi.mock('./data', () => ({
  useBasicFormSchema: () => [],
  useFinanceFormSchema: () => [],
  useInvoiceFormSchema: () => [],
  useSaleFormSchema: () => [],
  useSystemFormSchema: () => [],
}));
vi.mock('#/api/erp/sale/customer', () => ({
  recognizeCustomerBusinessLicense: state.recognize,
  createCustomer: state.create,
  updateCustomer: state.update,
  getCustomer: state.getCustomer,
  createCustomerBusinessInfo: state.saveBusiness,
  createCustomerImage: state.saveImage,
}));
vi.mock('#/api/system/area', () => ({ getAreaTree: state.areaTree }));
vi.mock('#/components/upload/use-upload', () => ({
  useUpload: () => ({
    httpRequest: async () => ({ url: '/test-license.png' }),
  }),
}));
vi.mock('./utils/business-license', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./utils/business-license')>()),
  readCustomerBusinessLicenseFileAsDataUrl: async () =>
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
      getData: () => state.customer,
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
    const api = {
      values: {} as Record<string, any>,
      getValues: async () => ({ ...api.values }),
      setValues: async (values: any) => {
        Object.assign(api.values, values);
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
  vi.clearAllMocks();
  state.forms = [];
  state.modals = [];
  state.customer = undefined;
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

describe('customer business license UI flow', () => {
  it('fills complete residence despite area failure, then saves it with OCR artifacts', async () => {
    state.areaTree.mockRejectedValueOnce(new Error('area unavailable'));
    await mount(CustomerForm);
    await uploadAndRecognize();
    expect(state.forms[0].api.values).toMatchObject({
      name: '杭州测试有限公司',
      detailAddress: address,
    });
    expect(state.forms[2].api.values.invoiceAddress).toBe(address);
    expect(state.forms[4].api.values.pinyinCode).toBeTruthy();
    expect(state.success).toHaveBeenCalledWith(
      expect.stringContaining('已填充 4 项'),
    );
    await state.modals[0].options.onConfirm();
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({ detailAddress: address }),
    );
    expect(state.saveBusiness).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 123 }),
    );
    expect(state.saveImage).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 123 }),
    );
    expect(onSuccess).toHaveBeenCalledWith({ id: 123, activeTab: 'business' });
    expect(state.confirm).not.toHaveBeenCalled();
  });

  it('waits for confirmation in create form before filling and saving, preserving the name', async () => {
    await mount(CustomerForm);
    state.forms[0].api.values = { name: '原客户', addressAreaId: 112 };
    await uploadAndRecognize();
    expect(state.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        okText: '继续填充',
        content: expect.stringContaining('当前客户名称：原客户'),
      }),
    );
    expect(state.forms[0].api.values.detailAddress).toBeUndefined();
    expect(state.forms[2].api.values.invoiceAddress).toBeUndefined();
    await state.modals[0].options.onConfirm();
    expect(state.create).not.toHaveBeenCalled();
    state.confirm.mock.calls[0]?.[0].onOk();
    await settle();
    expect(state.forms[0].api.values).toMatchObject({
      name: '原客户',
      addressAreaId: 112,
      detailAddress: address,
    });
    await state.modals[0].options.onConfirm();
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: '原客户', detailAddress: address }),
    );
  });

  it('waits for enterprise match confirmation before saving, refreshing and closing', async () => {
    state.customer = { id: 123, name: '原客户' };
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
    expect(state.customer.name).toBe('原客户');
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(state.modals[0].api.close).toHaveBeenCalledOnce();
  });

  it('does not fill or show a mismatch when OCR reports failure', async () => {
    state.recognize.mockResolvedValueOnce({
      success: false,
      message: '图片不清晰',
      invoiceCompany: '错误结果',
    });
    await mount(CustomerForm);
    state.forms[0].api.values.name = '原客户';
    await uploadAndRecognize();
    expect(state.forms[0].api.values.detailAddress).toBeUndefined();
    expect(state.confirm).not.toHaveBeenCalled();
    expect(state.error).toHaveBeenCalledWith('图片不清晰');
  });

  it('keeps manual edits through repeat recognition and clears upload state on reopening', async () => {
    await mount(CustomerForm);
    await uploadAndRecognize();
    state.forms[0].api.values.detailAddress = '人工修正地址';
    await uploadAndRecognize();
    expect(state.forms[0].api.values.detailAddress).toBe('人工修正地址');
    state.upload.remove();
    await nextTick();
    expect(state.upload.props.fileList).toEqual([]);
    await state.modals[0].options.onOpenChange(false);
    await state.modals[0].options.onOpenChange(true);
    expect(state.forms[0].api.values.detailAddress).toBeUndefined();
    expect(state.upload.props.fileList).toEqual([]);
  });

  it('loads the saved complete residence when editing', async () => {
    state.customer = { id: 123 };
    state.getCustomer.mockResolvedValueOnce({
      id: 123,
      name: '杭州测试有限公司',
      detailAddress: address,
    });
    await mount(CustomerForm);
    expect(state.forms[0].api.values.detailAddress).toBe(address);
    expect(root.querySelector('.customer-business-license-ocr')).toBeNull();
  });

  it.each(['onCancel', 'afterClose'])(
    'does not persist rejected create-page artifacts after %s',
    async (action) => {
      await mount(CustomerForm);
      state.forms[0].api.values.name = '原客户';
      await uploadAndRecognize();
      state.confirm.mock.calls[0]?.[0][action]();
      await settle();
      expect(state.forms[0].api.values.detailAddress).toBeUndefined();
      expect(state.forms[2].api.values.invoiceCompany).toBeUndefined();
      expect(state.areaTree).not.toHaveBeenCalled();
      await state.modals[0].options.onConfirm();
      expect(state.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: '原客户' }),
      );
      expect(state.saveBusiness).not.toHaveBeenCalled();
      expect(state.saveImage).not.toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith(123);
    },
  );

  it('allows retry after cancelling enterprise match and only saves after confirmation', async () => {
    state.customer = { id: 123, name: '原客户' };
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
    await mount(CustomerForm);
    state.forms[0].api.values.name = '原客户';
    await uploadAndRecognize();
    await state.modals[0].options.onOpenChange(false);
    await state.modals[0].options.onOpenChange(true);
    state.confirm.mock.calls[0]?.[0].onOk();
    await settle();
    expect(state.forms[0].api.values.detailAddress).toBeUndefined();
    expect(state.saveBusiness).not.toHaveBeenCalled();
  });

  it('continues without confirmation when enterprise names match after trimming', async () => {
    state.customer = { id: 123, name: ' 杭州测试有限公司 ' };
    await mount(EnterpriseMatch);
    state.upload.props.beforeUpload(new File(['image'], 'license.png'));
    await state.modals[0].options.onConfirm();
    expect(state.confirm).not.toHaveBeenCalled();
    expect(state.saveBusiness).toHaveBeenCalledOnce();
    expect(state.saveImage).toHaveBeenCalledOnce();
  });
});
