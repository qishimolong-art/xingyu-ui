import type { ErpCustomerApi } from '#/api/erp/sale/customer';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { h } from 'vue';
import { Button } from 'ant-design-vue';
import CustomerDeptSelect from './modules/customer-dept-select.vue';
import {
  getCustomerBaseOptionsPage,
  getCustomerFormDeptPage,
  getCustomerFilterDeptPage,
  getCustomerUserPage,
} from '#/api/erp/sale/customer';
import { withCandidateFocus } from '#/views/erp/utils/candidate-focus';

import { CommonStatusEnum, DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';

import { z } from '#/adapter/form';
import { getBaseDataSimpleList } from '#/api/erp/base';
import { getAreaTree } from '#/api/system/area';
import { getSimpleDeptList } from '#/api/system/dept';
import { getSimpleUserList } from '#/api/system/user';
import { prepareErpArchiveListColumns } from '#/views/erp/base/utils/archive-list-table';
import { withEnterBlurInputSchemas } from '#/views/erp/sale/utils/keyboard';
import {
  CUSTOMER_PRICE_LEVEL_VALUE_MAP,
  mapSelectablePriceLevelOptions,
} from '#/views/erp/sale/utils/price-level';
import { createOptionalNumberRule } from '#/views/erp/sale/utils/text-number';

type CustomerBaseOption = { label: string; value: number };
export type CustomerBaseOptionCodeMap = Readonly<Record<string, number>>;

type OptionalIntegerTextRuleOptions = {
  min?: number;
  requiredMessage?: string;
};

export interface CustomerBaseDataQuickCreatePayload {
  fieldName: string;
  title: string;
  type: string;
  valueMode: 'code-map' | 'id';
  valueMap?: CustomerBaseOptionCodeMap;
}

export interface CustomerFormSchemaOptions {
  canCreateBaseData?: boolean;
  selectedOptions?: Record<string, any[]>;
  onCreateBaseData?: (payload: CustomerBaseDataQuickCreatePayload) => void;
}

const HIDDEN_ID_FIELD = 'id';
const CUSTOMER_FORM_SELECT_POPUP_CLASS = 'customer-form-select-dropdown';
const CUSTOMER_SEARCH_SELECT_POPUP_CLASS = 'customer-search-select-dropdown';
export const CUSTOMER_ARCHIVE_HIDDEN_FIELDS = [
  'telephone',
  'financeTelephone',
] as const;
const CUSTOMER_ARCHIVE_HIDDEN_FIELD_SET = new Set<string>(
  CUSTOMER_ARCHIVE_HIDDEN_FIELDS,
);
const BASIC_FORM_FIELDS = [
  HIDDEN_ID_FIELD,
  'code',
  'manualInputCode',
  'name',
  'shortName',
  'relationType',
  'areaId',
  'customerType',
  'groupCustomer',
  'enterpriseMatchStatus',
  'contact',
  'telephone',
  'mobile',
  'financeTelephone',
  'addressAreaId',
  'detailAddress',
  'postCode',
];

const FINANCE_FORM_FIELDS = [
  HIDDEN_ID_FIELD,
  'accountName',
  'settleMethod',
  'settleLocked',
  'invoiceType',
  'minOrderAmount',
  'freightType',
  'commissionRate',
  'commissionEnabled',
  'creditEnabled',
  'creditLimit',
  'creditTermDays',
];

const INVOICE_FORM_FIELDS = [
  HIDDEN_ID_FIELD,
  'unifiedCreditCode',
  'taxNo',
  'bankName',
  'bankAccount',
  'bankAddress',
  'invoiceBankName',
  'invoiceBankAccount',
  'invoiceAddress',
  'invoiceTelephone',
  'invoiceCompany',
];

const SALE_FORM_FIELDS = [
  HIDDEN_ID_FIELD,
  'saleUserId',
  'developerUserId',
  'deptId',
  'priceLevel',
  'priceLocked',
  'logistics',
  'transportMethod',
  'routeId',
  'freightExplainId',
  'allowMultiDept',
  'deptIds',
];

const SYSTEM_FORM_FIELDS = [
  HIDDEN_ID_FIELD,
  'wubiCode',
  'pinyinCode',
  'memberCode',
  'platformCode',
  'status',
  'remark',
];

const CUSTOMER_FREIGHT_TYPE_VALUE_MAP: CustomerBaseOptionCodeMap = {
  customer_pay: 4,
  delivery_subsidy: 5,
  other: 2,
  pay_for_customer: 1,
  self_pay: 3,
};
const CUSTOMER_INVOICE_TYPE_VALUE_MAP: CustomerBaseOptionCodeMap = {
  normal_invoice: 2,
  receipt: 1,
  vat_invoice: 3,
};
const CUSTOMER_RELATION_TYPE_VALUE_MAP: CustomerBaseOptionCodeMap = {
  customer: 1,
  customer_supplier: 2,
};
const CUSTOMER_SETTLE_METHOD_VALUE_MAP: CustomerBaseOptionCodeMap = {
  cash: 1,
  credit: 2,
  online_payment: 4,
  remittance: 3,
};
const CUSTOMER_TRANSPORT_METHOD_VALUE_MAP: CustomerBaseOptionCodeMap = {
  customer_pickup: 1,
  delivery_service: 2,
  door_delivery: 4,
  logistics_consignment: 3,
};
export const CUSTOMER_TYPE_VALUE_MAP: CustomerBaseOptionCodeMap = {
  car_owner: 1,
  customer_supplier: 4,
  dealer: 7,
  repair_factory: 2,
  store: 6,
  supplier: 5,
  terminal_customer: 3,
};

function filterSelectOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const label = String(
    option?.label ?? option?.name ?? option?.title ?? option?.value ?? '',
  );
  return label.toLowerCase().includes(keyword);
}

function renderDeptOverflowPlaceholder(
  omittedValues: Array<{ label?: unknown; value?: unknown }>,
) {
  const title = omittedValues
    .map((item) => String(item.label ?? item.value ?? ''))
    .filter(Boolean)
    .join('、');
  return h(
    'span',
    {
      class: 'customer-dept-overflow-placeholder',
      title,
    },
    '…',
  );
}

function createOptionalIntegerTextRule(
  label: string,
  options: OptionalIntegerTextRuleOptions = {},
) {
  return z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .superRefine((value, ctx) => {
      const isEmpty =
        value === null ||
        value === undefined ||
        value === '' ||
        (typeof value === 'string' && value.trim() === '');
      if (isEmpty) {
        if (options.requiredMessage) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: options.requiredMessage,
          });
        }
        return;
      }

      const isIntegerText =
        typeof value === 'string' && /^-?\d+$/.test(value.trim());
      const isIntegerNumber =
        typeof value === 'number' &&
        Number.isFinite(value) &&
        Number.isInteger(value);
      if (!isIntegerText && !isIntegerNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label}必须是整数`,
        });
        return;
      }

      const parsed = typeof value === 'number' ? value : Number(value.trim());
      if (options.min !== undefined && parsed < options.min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label}不能小于 ${options.min}`,
        });
      }
    });
}

function isCustomerBaseOption(
  option: CustomerBaseOption | null,
): option is CustomerBaseOption {
  return Boolean(option);
}

async function getMappedBaseOptions(
  type: string,
  valueMap: CustomerBaseOptionCodeMap,
): Promise<CustomerBaseOption[]> {
  const list = await getBaseDataSimpleList(type);
  return list
    .map((item) => {
      const value = item.code ? valueMap[item.code] : undefined;
      return value === undefined ? null : { label: item.name, value };
    })
    .filter(isCustomerBaseOption);
}

async function getSelectablePriceLevelOptions() {
  return mapSelectablePriceLevelOptions(
    await getBaseDataSimpleList('price_level'),
  );
}

/** 新增/修改的表单 */
function createCustomerMappedBaseDataSelectProps(
  options: CustomerFormSchemaOptions,
  payload: CustomerBaseDataQuickCreatePayload & {
    valueMap: CustomerBaseOptionCodeMap;
  },
) {
  return {
    api: () =>
      payload.type === 'price_level'
        ? getSelectablePriceLevelOptions()
        : getMappedBaseOptions(payload.type, payload.valueMap),
    labelField: 'label',
    valueField: 'value',
    placeholder: `请选择${payload.title}`,
    allowClear: true,
    showSearch: true,
    filterOption: filterSelectOption,
    popupClassName: CUSTOMER_FORM_SELECT_POPUP_CLASS,
    alwaysLoad: true,
    canQuickCreate: options.canCreateBaseData ?? false,
    quickCreateTitle: `可选${payload.title}`,
    quickCreateText: '新增',
    onQuickCreate: () => options.onCreateBaseData?.(payload),
  };
}

function createCustomerIdBaseDataSelectProps(
  options: CustomerFormSchemaOptions,
  payload: CustomerBaseDataQuickCreatePayload,
) {
  return {
    api: () => getBaseDataSimpleList(payload.type),
    labelField: 'name',
    valueField: 'id',
    placeholder: `请选择${payload.title}`,
    allowClear: true,
    showSearch: true,
    filterOption: filterSelectOption,
    popupClassName: CUSTOMER_FORM_SELECT_POPUP_CLASS,
    alwaysLoad: true,
    canQuickCreate: options.canCreateBaseData ?? false,
    quickCreateTitle: `可选${payload.title}`,
    quickCreateText: '新增',
    onQuickCreate: () => options.onCreateBaseData?.(payload),
  };
}

function paginateCustomerSchemas(
  schema: VbenFormSchema[],
  options: CustomerFormSchemaOptions = {},
  search = false,
) {
  return withCandidateFocus(
    schema.map((field) => {
      const name = String(field.fieldName);
      const original = field.componentProps;
      if (name === 'deptIds')
        return {
          ...field,
          component: CustomerDeptSelect,
          componentProps: { class: 'w-full' },
        };
      const mappedFields: Record<string, [string, CustomerBaseOptionCodeMap?]> =
        {
          relationType: [
            'customer_category',
            { customer: 1, customer_supplier: 2 },
          ],
          customerType: ['customer_type', CUSTOMER_TYPE_VALUE_MAP],
          settleMethod: ['settle_method', CUSTOMER_SETTLE_METHOD_VALUE_MAP],
          invoiceType: ['invoice_type', CUSTOMER_INVOICE_TYPE_VALUE_MAP],
          freightType: ['freight_type', CUSTOMER_FREIGHT_TYPE_VALUE_MAP],
          transportMethod: [
            'delivery_method',
            CUSTOMER_TRANSPORT_METHOD_VALUE_MAP,
          ],
          areaId: ['sales_area'],
          routeId: ['route'],
          freightExplainId: ['freight_explain'],
        };
      if (name === 'priceLevel' || name === 'addressAreaId') {
        const props = original as any;
        const historicalPrice =
          name === 'priceLevel' &&
          options.selectedOptions?.priceLevel?.some(
            (option) => option.value === 6,
          );
        return {
          ...field,
          componentProps: {
            ...props,
            style: { width: '100%' },
            ...(historicalPrice
              ? {
                  api: async () => [
                    { label: '库存成本价（历史）', value: 6, disabled: true },
                    ...(await props.api()),
                  ],
                }
              : {}),
          },
        };
      }
      if (
        name === 'deptId' ||
        ['saleUserId', 'developerUserId', 'creator'].includes(name) ||
        mappedFields[name]
      ) {
        const old = (typeof original === 'object' ? original : {}) as any;
        const mapped = mappedFields[name];
        const api = mapped
          ? async (params: any) => {
              const page = await getCustomerBaseOptionsPage({
                ...params,
                type: mapped[0],
              });
              return {
                ...page,
                list: mapped[1]
                  ? page.list
                      .filter((item) => mapped[1]![item.code] !== undefined)
                      .map((item) => ({
                        ...item,
                        value: mapped[1]![item.code],
                        label: item.name,
                      }))
                  : page.list,
              };
            }
          : name === 'deptId'
            ? search
              ? getCustomerFilterDeptPage
              : getCustomerFormDeptPage
            : getCustomerUserPage;
        return {
          ...field,
          component: 'ErpLazyPageSelect' as const,
          componentProps: {
            api,
            valueField: mapped?.[1] ? 'value' : 'id',
            labelField: mapped || name === 'deptId' ? 'name' : 'nickname',
            pageSize: 20,
            placeholder: old.placeholder,
            class: 'w-full',
            style: { width: '100%' },
            options: options.selectedOptions?.[name] ?? [],
            popupClassName: search
              ? CUSTOMER_SEARCH_SELECT_POPUP_CLASS
              : CUSTOMER_FORM_SELECT_POPUP_CLASS,
            dropdownRender:
              old.onQuickCreate && options.canCreateBaseData
                ? ({ menuNode }: any) =>
                    h('div', [
                      h(
                        Button,
                        {
                          type: 'link',
                          size: 'small',
                          onMousedown: (event: MouseEvent) =>
                            event.preventDefault(),
                          onClick: old.onQuickCreate,
                        },
                        () => '+ 新增',
                      ),
                      menuNode,
                    ])
                : undefined,
          },
        };
      }
      // One form-level owner handles Enter across all five sections.
      const cleanEnterHandlers = (value: any) => {
        const props = { ...value };
        delete props.onKeydown;
        delete props.onPressEnter;
        return props;
      };
      return {
        ...field,
        componentProps:
          typeof original === 'function'
            ? (...args: any[]) => cleanEnterHandlers((original as any)(...args))
            : cleanEnterHandlers(original),
      };
    }),
  );
}

function hideCustomerArchiveFields(schema: VbenFormSchema[]) {
  return schema.filter(
    (item) =>
      !CUSTOMER_ARCHIVE_HIDDEN_FIELD_SET.has(String(item.fieldName || '')),
  );
}

export function useFormSchema(
  options: CustomerFormSchemaOptions = {},
): VbenFormSchema[] {
  return hideCustomerArchiveFields(
    withEnterBlurInputSchemas([
      {
        component: 'Input',
        fieldName: 'id',
        dependencies: {
          triggerFields: [''],
          show: () => false,
        },
      },
      {
        fieldName: 'code',
        label: '客户编码',
        component: 'Input',
        componentProps: (values) => {
          const manualInput = Boolean(values.manualInputCode);
          const isEdit = Boolean(values.id);
          return {
            placeholder: manualInput ? '请输入客户编码' : '系统自动生成',
            disabled: isEdit || !manualInput,
            allowClear: manualInput && !isEdit,
            maxlength: 64,
          };
        },
        dependencies: {
          triggerFields: ['manualInputCode'],
          rules: (values) =>
            values.manualInputCode && !values.id
              ? z.string().trim().min(1, '请输入客户编码')
              : z.string().optional(),
        },
      },
      {
        fieldName: 'manualInputCode',
        label: '手动填写',
        component: 'Checkbox',
        componentProps: (values) => ({
          disabled: Boolean(values.id),
        }),
        dependencies: {
          triggerFields: ['id'],
          show: (values) => !values.id,
        },
      },
      {
        fieldName: 'name',
        label: '客户名称',
        component: 'Input',
        rules: 'required',
        componentProps: { placeholder: '请输入客户名称' },
      },
      {
        fieldName: 'shortName',
        label: '简称',
        component: 'Input',
        componentProps: { placeholder: '请输入简称' },
      },
      {
        fieldName: 'relationType',
        defaultValue: null,
        label: '往来类别',
        component: 'QuickCreateApiSelect',
        rules: z.number({ message: '请选择往来类别' }),
        componentProps: {
          ...createCustomerMappedBaseDataSelectProps(options, {
            fieldName: 'relationType',
            title: '往来类别',
            type: 'customer_category',
            valueMap: CUSTOMER_RELATION_TYPE_VALUE_MAP,
            valueMode: 'code-map',
          }),
        },
      },
      {
        fieldName: 'areaId',
        label: '区域',
        component: 'QuickCreateApiSelect',
        componentProps: {
          ...createCustomerIdBaseDataSelectProps(options, {
            fieldName: 'areaId',
            title: '销售区域',
            type: 'sales_area',
            valueMode: 'id',
          }),
        },
      },
      {
        fieldName: 'customerType',
        label: '客户类型',
        component: 'QuickCreateApiSelect',
        componentProps: {
          ...createCustomerMappedBaseDataSelectProps(options, {
            fieldName: 'customerType',
            title: '客户类型',
            type: 'customer_type',
            valueMap: CUSTOMER_TYPE_VALUE_MAP,
            valueMode: 'code-map',
          }),
        },
      },
      {
        fieldName: 'groupCustomer',
        label: '集团客户',
        component: 'Switch',
        rules: z.boolean().optional(),
      },
      {
        fieldName: 'enterpriseMatchStatus',
        label: '企业匹配',
        component: 'Select',
        componentProps: {
          placeholder: '请选择企业匹配状态',
          allowClear: true,
          popupClassName: CUSTOMER_FORM_SELECT_POPUP_CLASS,
          options: [
            { label: '未同步', value: 0 },
            { label: '已同步', value: 1 },
          ],
        },
        rules: z.number().default(0).optional(),
      },
      {
        fieldName: 'contact',
        label: '联系人',
        component: 'Input',
        componentProps: { placeholder: '请输入联系人' },
      },
      {
        fieldName: 'telephone',
        label: '电话',
        component: 'Input',
        componentProps: { placeholder: '请输入电话' },
      },
      {
        fieldName: 'mobile',
        label: '手机号',
        component: 'Input',
        rules: 'required',
        componentProps: { placeholder: '请输入手机号' },
      },
      {
        fieldName: 'financeTelephone',
        label: '财务联系电话',
        component: 'Input',
        componentProps: { placeholder: '请输入财务联系电话' },
      },
      {
        fieldName: 'addressAreaId',
        label: '地址',
        component: 'ApiTreeSelect',
        componentProps: {
          api: getAreaTree,
          fieldNames: { label: 'name', value: 'id', children: 'children' },
          placeholder: '请选择省/市/区',
          allowClear: true,
          showSearch: true,
          popupClassName: CUSTOMER_FORM_SELECT_POPUP_CLASS,
          treeNodeFilterProp: 'name',
          treeDefaultExpandAll: false,
        },
      },
      {
        fieldName: 'detailAddress',
        label: '详细地址',
        component: 'Input',
        componentProps: { placeholder: '请输入详细地址' },
      },
      {
        fieldName: 'postCode',
        label: '邮政编码',
        component: 'Input',
        componentProps: { placeholder: '请输入邮政编码' },
      },
      {
        fieldName: 'accountName',
        label: '账户',
        component: 'Input',
        componentProps: { placeholder: '请输入账户' },
      },
      {
        fieldName: 'settleMethod',
        defaultValue: null,
        label: '结算方式',
        component: 'QuickCreateApiSelect',
        rules: z.number({ message: '请选择结算方式' }),
        componentProps: {
          ...createCustomerMappedBaseDataSelectProps(options, {
            fieldName: 'settleMethod',
            title: '结算方式',
            type: 'settle_method',
            valueMap: CUSTOMER_SETTLE_METHOD_VALUE_MAP,
            valueMode: 'code-map',
          }),
        },
      },
      {
        fieldName: 'settleLocked',
        label: '结算锁定',
        component: 'Switch',
        rules: z.boolean().optional(),
      },
      {
        fieldName: 'invoiceType',
        label: '开票类型',
        component: 'QuickCreateApiSelect',
        componentProps: {
          ...createCustomerMappedBaseDataSelectProps(options, {
            fieldName: 'invoiceType',
            title: '开票类型',
            type: 'invoice_type',
            valueMap: CUSTOMER_INVOICE_TYPE_VALUE_MAP,
            valueMode: 'code-map',
          }),
        },
      },
      {
        fieldName: 'minOrderAmount',
        label: '起订金额',
        component: 'Input',
        rules: createOptionalNumberRule('起订金额', { min: 0 }),
        componentProps: {
          class: 'w-full',
          placeholder: '请输入起订金额',
          inputmode: 'decimal',
        },
      },
      {
        fieldName: 'freightType',
        label: '运费类型',
        component: 'QuickCreateApiSelect',
        componentProps: {
          ...createCustomerMappedBaseDataSelectProps(options, {
            fieldName: 'freightType',
            title: '运费类型',
            type: 'freight_type',
            valueMap: CUSTOMER_FREIGHT_TYPE_VALUE_MAP,
            valueMode: 'code-map',
          }),
        },
      },
      {
        fieldName: 'commissionRate',
        label: '佣金比例',
        component: 'Input',
        rules: createOptionalNumberRule('佣金比例'),
        componentProps: {
          class: 'w-full',
          placeholder: '请输入佣金比例',
          precision: 2,
          addonAfter: '%',
        },
      },
      {
        fieldName: 'commissionEnabled',
        label: '启用佣金机制',
        component: 'Switch',
        rules: z.boolean().default(false).optional(),
      },
      {
        fieldName: 'creditEnabled',
        label: '白条授信',
        component: 'Switch',
        rules: z.boolean().default(false).optional(),
      },
      {
        fieldName: 'creditLimit',
        label: '授信金额',
        component: 'Input',
        rules: createOptionalNumberRule('授信金额', { min: 0 }),
        componentProps: {
          inputmode: 'decimal',
          class: 'w-full',
          placeholder: '请输入授信金额',
        },
      },
      {
        fieldName: 'creditTermDays',
        label: '授信期限（天）',
        component: 'Input',
        componentProps: {
          class: 'w-full',
          placeholder: '请输入授信期限',
          inputmode: 'numeric',
        },
        dependencies: {
          triggerFields: ['creditEnabled', 'creditLimit'],
          rules: (values) => {
            const hasLimit =
              values.creditLimit !== undefined &&
              values.creditLimit !== null &&
              values.creditLimit !== '';
            if (values.creditEnabled && !hasLimit) {
              return createOptionalIntegerTextRule('授信期限', {
                min: 0,
                requiredMessage:
                  '开启白条授信后，授信金额和授信期限至少填写一项',
              });
            }
            return createOptionalIntegerTextRule('授信期限', { min: 0 });
          },
        },
      },
      {
        fieldName: 'unifiedCreditCode',
        label: '统一信用代码',
        component: 'Input',
        componentProps: { placeholder: '请输入统一信用代码' },
      },
      {
        fieldName: 'taxNo',
        label: '纳税人识别号',
        component: 'Input',
        componentProps: { placeholder: '请输入纳税人识别号' },
      },
      {
        fieldName: 'bankName',
        label: '开户行',
        component: 'Input',
        componentProps: { placeholder: '请输入开户行' },
      },
      {
        fieldName: 'bankAccount',
        label: '开户账号',
        component: 'Input',
        componentProps: { placeholder: '请输入开户账号' },
      },
      {
        fieldName: 'bankAddress',
        label: '开户地址',
        component: 'Input',
        componentProps: { placeholder: '请输入开户地址' },
      },
      {
        fieldName: 'invoiceBankName',
        label: '开票银行',
        component: 'Input',
        componentProps: { placeholder: '请输入开票银行' },
      },
      {
        fieldName: 'invoiceBankAccount',
        label: '开票银行账号',
        component: 'Input',
        componentProps: { placeholder: '请输入开票银行账号' },
      },
      {
        fieldName: 'invoiceAddress',
        label: '开票地址',
        component: 'Input',
        componentProps: { placeholder: '请输入开票地址' },
      },
      {
        fieldName: 'invoiceTelephone',
        label: '开票电话',
        component: 'Input',
        componentProps: { placeholder: '请输入开票电话' },
      },
      {
        fieldName: 'invoiceCompany',
        label: '开票单位',
        component: 'Input',
        componentProps: { placeholder: '请输入开票单位' },
      },
      {
        fieldName: 'saleUserId',
        label: '所属业务员',
        component: 'ApiSelect',
        componentProps: {
          api: getSimpleUserList,
          labelField: 'nickname',
          valueField: 'id',
          placeholder: '请选择所属业务员',
          allowClear: true,
          showSearch: true,
          filterOption: filterSelectOption,
          popupClassName: CUSTOMER_FORM_SELECT_POPUP_CLASS,
        },
      },
      {
        fieldName: 'developerUserId',
        label: '所属开发员',
        component: 'ApiSelect',
        componentProps: {
          api: getSimpleUserList,
          labelField: 'nickname',
          valueField: 'id',
          placeholder: '请选择所属开发员',
          allowClear: true,
          showSearch: true,
          filterOption: filterSelectOption,
          popupClassName: CUSTOMER_FORM_SELECT_POPUP_CLASS,
        },
      },
      {
        fieldName: 'deptId',
        label: '所属部门',
        component: 'ApiTreeSelect',
        componentProps: {
          api: getSimpleDeptList,
          fieldNames: { label: 'name', value: 'id', children: 'children' },
          placeholder: '请选择所属部门',
          allowClear: true,
          showSearch: true,
          popupClassName: CUSTOMER_FORM_SELECT_POPUP_CLASS,
          treeNodeFilterProp: 'name',
          treeDefaultExpandAll: false,
        },
      },
      {
        fieldName: 'priceLevel',
        label: '价格级别',
        component: 'QuickCreateApiSelect',
        rules: z.number({ message: '请选择价格级别' }).default(3),
        componentProps: {
          ...createCustomerMappedBaseDataSelectProps(options, {
            fieldName: 'priceLevel',
            title: '价格级别',
            type: 'price_level',
            valueMap: CUSTOMER_PRICE_LEVEL_VALUE_MAP,
            valueMode: 'code-map',
          }),
        },
      },
      {
        fieldName: 'priceLocked',
        label: '价格锁定',
        component: 'Switch',
        rules: z.boolean().optional(),
      },
      {
        fieldName: 'logistics',
        label: '是否物流',
        component: 'Switch',
        rules: z.boolean().optional(),
      },
      {
        fieldName: 'transportMethod',
        label: '运输方式',
        component: 'QuickCreateApiSelect',
        componentProps: {
          ...createCustomerMappedBaseDataSelectProps(options, {
            fieldName: 'transportMethod',
            title: '运输方式',
            type: 'delivery_method',
            valueMap: CUSTOMER_TRANSPORT_METHOD_VALUE_MAP,
            valueMode: 'code-map',
          }),
        },
      },
      {
        fieldName: 'routeId',
        label: '线路',
        component: 'QuickCreateApiSelect',
        componentProps: {
          ...createCustomerIdBaseDataSelectProps(options, {
            fieldName: 'routeId',
            title: '线路',
            type: 'route',
            valueMode: 'id',
          }),
        },
      },
      {
        fieldName: 'freightExplainId',
        label: '运费说明',
        component: 'QuickCreateApiSelect',
        componentProps: {
          ...createCustomerIdBaseDataSelectProps(options, {
            fieldName: 'freightExplainId',
            title: '运费说明',
            type: 'freight_explain',
            valueMode: 'id',
          }),
        },
      },
      {
        fieldName: 'wubiCode',
        label: '五笔码',
        component: 'Input',
        componentProps: { placeholder: '请输入五笔码' },
      },
      {
        fieldName: 'pinyinCode',
        label: '拼音码',
        component: 'Input',
        componentProps: { placeholder: '请输入拼音码' },
      },
      {
        fieldName: 'memberCode',
        label: '会员编码',
        component: 'Input',
        componentProps: { placeholder: '系统自动生成', disabled: true },
        dependencies: { triggerFields: ['id'], show: (values) => !!values.id },
      },
      {
        fieldName: 'platformCode',
        label: '平台唯一码',
        component: 'Input',
        componentProps: { placeholder: '系统自动生成', disabled: true },
        dependencies: { triggerFields: ['id'], show: (values) => !!values.id },
      },
      {
        fieldName: 'status',
        label: '状态',
        component: 'RadioGroup',
        componentProps: {
          options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
          buttonStyle: 'solid',
          optionType: 'button',
        },
        rules: z.number().default(CommonStatusEnum.ENABLE),
      },
      {
        fieldName: 'allowMultiDept',
        label: '允许多部门',
        component: 'Switch',
        rules: z.boolean().default(false).optional(),
      },
      {
        fieldName: 'deptIds',
        label: '适用部门',
        component: 'ApiTreeSelect',
        componentProps: {
          api: getSimpleDeptList,
          fieldNames: { label: 'name', value: 'id', children: 'children' },
          multiple: true,
          placeholder: '请选择适用部门',
          allowClear: true,
          showSearch: true,
          popupClassName: CUSTOMER_FORM_SELECT_POPUP_CLASS,
          treeCheckable: true,
          treeCheckStrictly: true,
          labelInValue: true,
          treeNodeFilterProp: 'name',
          treeDefaultExpandAll: false,
          maxTagCount: 'responsive',
          maxTagPlaceholder: renderDeptOverflowPlaceholder,
          class: 'customer-dept-multiple-select w-full',
        },
        dependencies: {
          triggerFields: ['allowMultiDept'],
          show: (values) => values.allowMultiDept === true,
        },
        formItemClass: 'customer-dept-form-item col-span-2',
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Textarea',
        componentProps: { placeholder: '请输入备注', rows: 3 },
        formItemClass: 'col-span-2',
      },
    ]),
  );
}
function pickFormSchema(
  fieldNames: string[],
  options: CustomerFormSchemaOptions = {},
): VbenFormSchema[] {
  const fields = new Set(fieldNames);
  return paginateCustomerSchemas(
    useFormSchema(options).filter((item) => {
      const fieldName = String(item.fieldName || '');
      return fields.has(fieldName);
    }),
    options,
  );
}

export function useBasicFormSchema(
  options: CustomerFormSchemaOptions = {},
): VbenFormSchema[] {
  const schema = pickFormSchema(BASIC_FORM_FIELDS, options);
  return [
    ...schema.filter((field) => field.fieldName === 'name'),
    ...schema.filter((field) => field.fieldName !== 'name'),
  ];
}

export function useFinanceFormSchema(
  options: CustomerFormSchemaOptions = {},
): VbenFormSchema[] {
  return pickFormSchema(FINANCE_FORM_FIELDS, options);
}

export function useInvoiceFormSchema(
  options: CustomerFormSchemaOptions = {},
): VbenFormSchema[] {
  return pickFormSchema(INVOICE_FORM_FIELDS, options);
}

export function useSaleFormSchema(
  options: CustomerFormSchemaOptions = {},
): VbenFormSchema[] {
  return pickFormSchema(SALE_FORM_FIELDS, options);
}

export function useSystemFormSchema(
  options: CustomerFormSchemaOptions = {},
): VbenFormSchema[] {
  return pickFormSchema(SYSTEM_FORM_FIELDS, options);
}

/** 列表的搜索表单 */
export function useGridFormSchema(): VbenFormSchema[] {
  return paginateCustomerSchemas(
    withEnterBlurInputSchemas([
      {
        fieldName: 'code',
        label: '编码',
        component: 'Input',
        componentProps: {
          placeholder: '请输入编码',
          allowClear: true,
          'data-erp-archive-code-search-input': 'true',
        },
      },
      {
        fieldName: 'name',
        label: '名称',
        component: 'Input',
        componentProps: {
          placeholder: '请输入名称',
          allowClear: true,
          'data-erp-archive-name-search-input': 'true',
        },
      },
      {
        fieldName: 'deptId',
        label: '所属部门',
        component: 'ApiTreeSelect',
        componentProps: {
          api: getSimpleDeptList,
          fieldNames: { label: 'name', value: 'id', children: 'children' },
          placeholder: '请选择所属部门',
          allowClear: true,
          showSearch: true,
          popupClassName: CUSTOMER_SEARCH_SELECT_POPUP_CLASS,
          treeNodeFilterProp: 'name',
          treeDefaultExpandAll: false,
        },
      },
      {
        fieldName: 'settleMethod',
        label: '默认结算方式',
        component: 'ApiSelect',
        componentProps: {
          api: () =>
            getMappedBaseOptions(
              'settle_method',
              CUSTOMER_SETTLE_METHOD_VALUE_MAP,
            ),
          labelField: 'label',
          valueField: 'value',
          placeholder: '请选择默认结算方式',
          allowClear: true,
          showSearch: true,
          popupClassName: CUSTOMER_SEARCH_SELECT_POPUP_CLASS,
          filterOption: filterSelectOption,
        },
      },
      {
        fieldName: 'priceLevel',
        label: '价格级别',
        component: 'ApiSelect',
        componentProps: {
          api: getSelectablePriceLevelOptions,
          labelField: 'label',
          valueField: 'value',
          placeholder: '请选择价格级别',
          allowClear: true,
          showSearch: true,
          popupClassName: CUSTOMER_SEARCH_SELECT_POPUP_CLASS,
          filterOption: filterSelectOption,
        },
      },
      {
        fieldName: 'areaId',
        label: '区域',
        component: 'ApiSelect',
        componentProps: {
          api: () => getBaseDataSimpleList('sales_area'),
          labelField: 'name',
          valueField: 'id',
          placeholder: '请选择区域',
          allowClear: true,
          showSearch: true,
          popupClassName: CUSTOMER_SEARCH_SELECT_POPUP_CLASS,
          filterOption: filterSelectOption,
        },
      },
      {
        fieldName: 'routeId',
        label: '线路',
        component: 'ApiSelect',
        componentProps: {
          api: () => getBaseDataSimpleList('route'),
          labelField: 'name',
          valueField: 'id',
          placeholder: '请选择线路',
          allowClear: true,
          showSearch: true,
          popupClassName: CUSTOMER_SEARCH_SELECT_POPUP_CLASS,
          filterOption: filterSelectOption,
        },
      },
      {
        fieldName: 'saleUserId',
        label: '所属业务员',
        component: 'ApiSelect',
        componentProps: {
          api: getSimpleUserList,
          labelField: 'nickname',
          valueField: 'id',
          placeholder: '请选择所属业务员',
          allowClear: true,
          showSearch: true,
          popupClassName: CUSTOMER_SEARCH_SELECT_POPUP_CLASS,
          filterOption: filterSelectOption,
        },
      },
      {
        fieldName: 'customerType',
        label: '客户类型',
        component: 'ApiSelect',
        componentProps: {
          api: () =>
            getMappedBaseOptions('customer_type', CUSTOMER_TYPE_VALUE_MAP),
          labelField: 'label',
          valueField: 'value',
          placeholder: '请选择客户类型',
          allowClear: true,
          showSearch: true,
          popupClassName: CUSTOMER_SEARCH_SELECT_POPUP_CLASS,
          filterOption: filterSelectOption,
        },
      },
      {
        fieldName: 'address',
        label: '地址',
        component: 'Input',
        componentProps: {
          placeholder: '请输入地址',
          allowClear: true,
        },
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Input',
        componentProps: {
          placeholder: '请输入备注',
          allowClear: true,
        },
      },
      {
        fieldName: 'creator',
        label: '创建人',
        component: 'ApiSelect',
        componentProps: {
          api: getSimpleUserList,
          labelField: 'nickname',
          valueField: 'id',
          placeholder: '请选择创建人',
          allowClear: true,
          showSearch: true,
          popupClassName: CUSTOMER_SEARCH_SELECT_POPUP_CLASS,
          filterOption: filterSelectOption,
        },
      },
    ]),
    {},
    true,
  );
}

/** 列表的字段 */
export function useGridColumns(
  rows: ErpCustomerApi.Customer[] = [],
): VxeTableGridOptions['columns'] {
  return prepareErpArchiveListColumns(
    [
      { type: 'checkbox', width: 40 },
      {
        field: 'contactAction',
        title: '联系人',
        minWidth: 100,
        slots: { default: 'contactAction' },
      },
      {
        field: 'code',
        title: '编码',
        minWidth: 110,
        sortable: true,
      },
      {
        field: 'name',
        title: '名称',
        minWidth: 150,
        sortable: true,
        treeNode: false,
        slots: { default: 'name' },
      },
      {
        field: 'enterpriseMatchStatusAction',
        title: '企业匹配',
        minWidth: 90,
        sortable: true,
        slots: { default: 'enterpriseMatchStatusAction' },
      },
      {
        field: 'status',
        title: '状态',
        minWidth: 80,
        sortable: true,
        formatter: () => '已终审',
      },
      {
        field: 'settleMethodName',
        title: '默认结算方式',
        minWidth: 110,
        sortable: true,
      },
      {
        field: 'priceLevelName',
        title: '价格级别',
        minWidth: 120,
      },
      {
        field: 'areaName',
        title: '区域',
        minWidth: 90,
        sortable: true,
      },
      {
        field: 'routeName',
        title: '线路',
        minWidth: 90,
        sortable: true,
      },
      {
        field: 'saleUserName',
        title: '所属业务员',
        minWidth: 110,
        sortable: true,
      },
      {
        field: 'customerTypeName',
        title: '客户类型',
        minWidth: 100,
        sortable: true,
      },
      {
        field: 'detailAddress',
        title: '地址',
        minWidth: 200,
        sortable: true,
        showOverflow: 'tooltip',
        formatter: ({ row }: { row: any }) =>
          row.detailAddress || row.address || '-',
      },
      {
        field: 'remark',
        title: '备注',
        minWidth: 150,
        sortable: true,
        showOverflow: 'tooltip',
      },
      {
        field: 'creator',
        title: '创建人',
        formatter: ({ row }: any) => row.creatorName ?? row.creator ?? '-',
        minWidth: 100,
        sortable: true,
      },
      {
        field: 'createTime',
        title: '创建时间',
        minWidth: 160,
        formatter: 'formatDateTime',
        sortable: true,
      },
      {
        field: 'mobile',
        title: '联系方式',
        minWidth: 130,
        sortable: true,
        formatter: ({ row }: { row: any }) =>
          row.mobile || row.telephone || '-',
      },
      {
        field: 'creditLimit',
        title: '授信金额',
        minWidth: 100,
        formatter: ({ cellValue }: any) =>
          cellValue === null || cellValue === undefined
            ? '-'
            : Number(cellValue).toFixed(2),
      },
      {
        field: 'creditStatus',
        title: '授信状态',
        minWidth: 140,
        slots: { default: 'creditStatus' },
      },
      {
        field: 'actions',
        title: '操作',
        width: 220,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    rows,
  );
}
