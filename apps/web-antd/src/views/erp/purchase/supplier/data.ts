import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { h, markRaw } from 'vue';

import { Button } from 'ant-design-vue';

import { z } from '#/adapter/form';
import {
  getSupplierAssignableUsersPage,
  getSupplierBaseOptionsPage,
  getSupplierDeptPage,
  getSupplierFormDeptPage,
} from '#/api/erp/purchase/supplier';
import { getAreaTree } from '#/api/system/area';
import { applyFieldPermission } from '#/composables/useFieldPermission';
import { prepareErpArchiveListColumns } from '#/views/erp/base/utils/archive-list-table';
import {
  applyPurchaseGridColumnPermission,
  applyPurchaseGridFormFieldPermission,
} from '#/views/erp/purchase/utils/field-permission';

import SupplierDeptSelect from './modules/supplier-dept-select.vue';

export interface SupplierBaseDataQuickCreatePayload {
  fieldName: string;
  title: string;
  type: string;
  valueField?: 'id' | 'name';
}

export interface SupplierFormSchemaOptions {
  canCreateBaseData?: boolean;
  deptLabelInValue?: boolean;
  deptOptions?: any[];
  userOptions?: any[];
  onCreateBaseData?: (payload: SupplierBaseDataQuickCreatePayload) => void;
}

function filterOptionByVisibleText(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const label = String(
    option?.name ?? option?.label ?? option?.title ?? option?.value ?? '',
  );
  return label.toLowerCase().includes(keyword);
}

function createBaseDataSelectProps(
  options: SupplierFormSchemaOptions,
  payload: SupplierBaseDataQuickCreatePayload,
) {
  return {
    labelField: 'name',
    valueField: payload.valueField ?? 'name',
    pageSize: 20,
    popupClassName: 'supplier-form-select-dropdown erp-candidate-focus-popup',
    dropdownRender: ({ menuNode }: any) =>
      h('div', [
        options.canCreateBaseData
          ? h(
              Button,
              {
                type: 'link',
                size: 'small',
                onMousedown: (event: MouseEvent) => event.preventDefault(),
                onClick: () => options.onCreateBaseData?.(payload),
              },
              () => `+ ${payload.title}`,
            )
          : null,
        menuNode,
      ]),
  };
}

export function parseOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function createOptionalNumberRule(
  label: string,
  options: { integer?: boolean; max?: number; min?: number } = {},
) {
  return z
    .union([z.string(), z.number()])
    .nullish()
    .refine((value) => {
      return (
        value === null ||
        value === undefined ||
        value === '' ||
        parseOptionalNumber(value) !== undefined
      );
    }, `${label}必须为数字`)
    .refine((value) => {
      const parsed = parseOptionalNumber(value);
      return (
        parsed === undefined ||
        options.min === undefined ||
        parsed >= options.min
      );
    }, `${label}不能小于 ${options.min}`)
    .refine((value) => {
      const parsed = parseOptionalNumber(value);
      return (
        parsed === undefined ||
        options.max === undefined ||
        parsed <= options.max
      );
    }, `${label}不能大于 ${options.max}`)
    .refine((value) => {
      const parsed = parseOptionalNumber(value);
      return (
        parsed === undefined || !options.integer || Number.isInteger(parsed)
      );
    }, `${label}必须为整数`);
}

export function formatOptionalNumberInput(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim();
}

export function toOptionalNumberValue(value: unknown) {
  return parseOptionalNumber(formatOptionalNumberInput(value));
}

/** 鍩虹淇℃伅琛ㄥ崟 */
export function useBasicFormSchema(
  hiddenFields: string[] = [],
  options: SupplierFormSchemaOptions = {},
): VbenFormSchema[] {
  return applyFieldPermission(
    [
      {
        component: 'Input',
        fieldName: 'id',
        dependencies: {
          triggerFields: [''],
          show: () => false,
        },
      },
      {
        fieldName: 'name',
        label: '供应商名称',
        component: 'Input',
        rules: 'required',
        componentProps: {
          placeholder: '请输入供应商名称',
        },
      },
      {
        fieldName: 'shortName',
        label: '简称',
        component: 'Input',
        componentProps: {
          placeholder: '请输入简称',
        },
      },
      {
        fieldName: 'pinyinCode',
        label: '拼音码',
        component: 'Input',
        componentProps: {
          placeholder: '按供应商名称自动生成，可手动修改',
          allowClear: true,
          maxlength: 64,
        },
      },
      {
        fieldName: 'wubiCode',
        label: '五笔码',
        component: 'Input',
        componentProps: {
          placeholder: '按供应商名称自动生成，可手动修改',
          allowClear: true,
          maxlength: 32,
        },
      },
      {
        fieldName: 'code',
        label: '编码',
        component: 'Input',
        componentProps: (values) => {
          const manualInput = Boolean(values.manualInputCode);
          const isEdit = Boolean(values.id);
          return {
            placeholder: manualInput
              ? '请输入供应商编码'
              : '保存后系统自动生成',
            disabled: isEdit || !manualInput,
            allowClear: manualInput && !isEdit,
            maxlength: 64,
          };
        },
        dependencies: {
          triggerFields: ['id', 'manualInputCode'],
          rules: (values) =>
            values.manualInputCode && !values.id
              ? z.string().trim().min(1, '请输入供应商编码')
              : z.string().optional(),
        },
      },
      {
        fieldName: 'manualInputCode',
        label: '手动填写',
        component: 'Checkbox',
        componentProps: (values) => ({
          disabled: Boolean(values.id),
          'data-erp-enter-focus-skip': 'true',
        }),
        dependencies: {
          triggerFields: ['id'],
          show: (values) => !values.id,
        },
      },
      {
        fieldName: 'deptId',
        label: '所属部门',
        component: 'ErpLazyPageSelect',
        componentProps: {
          api: getSupplierFormDeptPage,
          labelField: 'name',
          valueField: 'id',
          pageSize: 20,
          options: options.deptOptions ?? [],
          labelInValue: options.deptLabelInValue ?? false,
          popupClassName:
            'supplier-form-select-dropdown erp-candidate-focus-popup',
        },
        rules: 'selectRequired',
      },
      {
        fieldName: 'allowMultiDept',
        label: '允许多部门',
        component: 'RadioGroup',
        defaultValue: false,
        componentProps: {
          options: [
            { label: '否', value: false },
            { label: '是', value: true },
          ],
        },
      },
      {
        fieldName: 'deptIds',
        label: '适用部门',
        component: markRaw(SupplierDeptSelect),
        componentProps: { class: 'supplier-dept-multiple-select w-full' },
        dependencies: {
          triggerFields: ['allowMultiDept'],
          show: (values) => values.allowMultiDept === true,
        },
      },
      {
        fieldName: 'contact',
        label: '联系人',
        component: 'Input',
        componentProps: {
          placeholder: '请输入联系人',
        },
      },
      {
        fieldName: 'mobile',
        label: '手机号码',
        component: 'Input',
        componentProps: {
          placeholder: '请输入手机号码',
        },
      },
      {
        fieldName: 'telephone',
        label: '联系电话',
        component: 'Input',
        componentProps: {
          placeholder: '请输入联系电话',
        },
      },
      {
        fieldName: 'email',
        label: '电子邮箱',
        component: 'Input',
        componentProps: {
          placeholder: '请输入电子邮箱',
        },
      },
      {
        fieldName: 'areaIds',
        label: '省市区',
        component: 'ApiCascader',
        componentProps: {
          api: getAreaTree,
          style: { width: '100%' },
          fieldNames: { label: 'name', value: 'name', children: 'children' },
          placeholder: '请选择省市区',
          allowClear: true,
          showSearch: true,
          changeOnSelect: true,
          popupClassName: 'supplier-form-select-dropdown',
        },
      },
      {
        fieldName: 'address',
        label: '地址',
        component: 'Input',
        componentProps: {
          placeholder: '请输入地址',
        },
      },
      {
        fieldName: 'category',
        label: '供应商类别',
        component: 'ErpLazyPageSelect',
        defaultValue: '供应商',
        componentProps: {
          api: (params: any) =>
            getSupplierBaseOptionsPage({
              ...params,
              type: 'supplier_category',
              status: 0,
            }),
          placeholder: '请选择供应商类别',
          ...createBaseDataSelectProps(options, {
            fieldName: 'category',
            title: '供应商类别',
            type: 'supplier_category',
            valueField: 'name',
          }),
        },
      },
      {
        fieldName: 'purchaser',
        label: '采购员',
        component: 'ErpLazyPageSelect',
        componentProps: {
          api: getSupplierAssignableUsersPage,
          options: options.userOptions ?? [],
          labelField: 'nickname',
          valueField: 'id',
          placeholder: '请选择采购员',
          popupClassName: 'supplier-form-select-dropdown',
        },
      },
      {
        fieldName: 'settleMethod',
        label: '结算方式',
        component: 'ErpLazyPageSelect',
        componentProps: {
          api: (params: any) =>
            getSupplierBaseOptionsPage({
              ...params,
              type: 'settle_method',
              status: 0,
            }),
          placeholder: '请选择结算方式',
          ...createBaseDataSelectProps(options, {
            fieldName: 'settleMethod',
            title: '结算方式',
            type: 'settle_method',
            valueField: 'name',
          }),
        },
      },
      {
        fieldName: 'transportMethod',
        label: '运输方式',
        component: 'ErpLazyPageSelect',
        componentProps: {
          api: (params: any) =>
            getSupplierBaseOptionsPage({
              ...params,
              type: 'delivery_method',
              status: 0,
            }),
          placeholder: '请选择运输方式',
          ...createBaseDataSelectProps(options, {
            fieldName: 'transportMethod',
            title: '运输方式',
            type: 'delivery_method',
            valueField: 'name',
          }),
        },
      },
      {
        fieldName: 'freightType',
        label: '运费类型',
        component: 'ErpLazyPageSelect',
        componentProps: {
          api: (params: any) =>
            getSupplierBaseOptionsPage({
              ...params,
              type: 'freight_type',
              status: 0,
            }),
          placeholder: '请选择运费类型',
          ...createBaseDataSelectProps(options, {
            fieldName: 'freightType',
            title: '运费类型',
            type: 'freight_type',
            valueField: 'name',
          }),
        },
      },
      {
        fieldName: 'logisticsCompany',
        label: '物流公司',
        component: 'ErpLazyPageSelect',
        componentProps: {
          api: (params: any) =>
            getSupplierBaseOptionsPage({
              ...params,
              type: 'logistics_company',
              status: 0,
            }),
          placeholder: '请选择物流公司',
          ...createBaseDataSelectProps(options, {
            fieldName: 'logisticsCompany',
            title: '物流公司',
            type: 'logistics_company',
            valueField: 'name',
          }),
        },
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Textarea',
        componentProps: {
          placeholder: '请输入备注',
          rows: 3,
        },
        formItemClass: 'col-span-2',
      },
    ],
    hiddenFields,
  );
}

/** 寮€绁ㄤ俊鎭〃鍗?*/
export function useInvoiceFormSchema(
  hiddenFields: string[] = [],
  options: SupplierFormSchemaOptions = {},
): VbenFormSchema[] {
  return applyFieldPermission(
    [
      {
        fieldName: 'invoiceType',
        label: '开票类型',
        component: 'ErpLazyPageSelect',
        defaultValue: '收据',
        componentProps: {
          api: (params: any) =>
            getSupplierBaseOptionsPage({
              ...params,
              type: 'invoice_type',
              status: 0,
            }),
          placeholder: '请选择开票类型',
          ...createBaseDataSelectProps(options, {
            fieldName: 'invoiceType',
            title: '开票类型',
            type: 'invoice_type',
            valueField: 'name',
          }),
        },
      },
      {
        fieldName: 'taxpayerId',
        label: '纳税人识别号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入纳税人识别号',
        },
      },
      {
        fieldName: 'invoiceBank',
        label: '开票银行',
        component: 'Input',
        componentProps: {
          placeholder: '请输入开票银行',
        },
      },
      {
        fieldName: 'invoiceBankAccount',
        label: '开票银行账号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入开票银行账号',
        },
      },
      {
        fieldName: 'invoiceAddress',
        label: '开票地址',
        component: 'Input',
        componentProps: {
          placeholder: '请输入开票地址',
        },
      },
      {
        fieldName: 'invoicePhone',
        label: '开票电话',
        component: 'Input',
        componentProps: {
          placeholder: '请输入开票电话',
        },
      },
      {
        fieldName: 'invoiceCompany',
        label: '开票单位',
        component: 'Input',
        componentProps: {
          placeholder: '请输入开票单位',
        },
      },
    ],
    hiddenFields,
  );
}

/** 璐㈠姟淇℃伅琛ㄥ崟 */
export function useFinanceFormSchema(
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return applyFieldPermission(
    [
      {
        fieldName: 'account',
        label: '账户',
        component: 'Input',
        componentProps: {
          placeholder: '请输入账户',
        },
      },
      {
        fieldName: 'bankName',
        label: '开户行',
        component: 'Input',
        componentProps: {
          placeholder: '请输入开户行',
        },
      },
      {
        fieldName: 'bankAccount',
        label: '开户账号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入开户账号',
        },
      },
      {
        fieldName: 'bankAddress',
        label: '开户地址',
        component: 'Input',
        componentProps: {
          placeholder: '请输入开户地址',
        },
      },
      {
        fieldName: 'taxNo',
        label: '纳税人识别号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入纳税人识别号',
        },
      },
      {
        fieldName: 'taxPercent',
        label: '税率(%)',
        component: 'Input',
        formFieldProps: {
          validateOnBlur: true,
        },
        componentProps: {
          class: 'w-full',
          placeholder: '请输入税率',
        },
        rules: createOptionalNumberRule('税率', { min: 0 }),
      },
      {
        fieldName: 'financePhone',
        label: '财务联系电话',
        component: 'Input',
        componentProps: {
          placeholder: '请输入财务联系电话',
        },
      },
      {
        fieldName: 'memberCode',
        label: '会员编码',
        component: 'Input',
        componentProps: {
          placeholder: '系统自动生成',
          disabled: true,
        },
      },
      {
        fieldName: 'legalPerson',
        label: '法定代表',
        component: 'Input',
        componentProps: {
          placeholder: '请输入法定代表',
        },
      },
      {
        fieldName: 'creditCode',
        label: '统一信用代码',
        component: 'Input',
        componentProps: {
          placeholder: '请输入统一信用代码',
        },
      },
    ],
    hiddenFields,
  );
}

/** 鍏煎鏃х殑 useFormSchema锛堜緵鍏朵粬鍦版柟寮曠敤锛?*/
export function useFormSchema(hiddenFields: string[] = []): VbenFormSchema[] {
  return useBasicFormSchema(hiddenFields);
}

/** 鎼滅储琛ㄥ崟 */
export function useGridFormSchema(
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  return applyPurchaseGridFormFieldPermission(
    [
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
        component: 'ErpLazyPageSelect',
        componentProps: {
          api: getSupplierDeptPage,
          labelField: 'name',
          valueField: 'id',
          pageSize: 20,
          allowClear: true,
          popupClassName:
            'supplier-search-select-dropdown erp-candidate-focus-popup',
        },
      },
      {
        fieldName: 'settleMethod',
        label: '结算方式',
        component: 'ErpLazyPageSelect',
        componentProps: {
          api: (params: any) =>
            getSupplierBaseOptionsPage({
              ...params,
              type: 'settle_method',
              status: 0,
            }),
          labelField: 'name',
          valueField: 'name',
          placeholder: '请选择默认结算方式',
          allowClear: true,
          showSearch: true,
          filterOption: filterOptionByVisibleText,
          popupClassName: 'supplier-search-select-dropdown',
        },
      },
      {
        fieldName: 'region',
        label: '区域',
        component: 'ErpLazyPageSelect',
        componentProps: {
          api: (params: any) =>
            getSupplierBaseOptionsPage({
              ...params,
              type: 'region',
              status: 0,
            }),
          labelField: 'name',
          valueField: 'name',
          placeholder: '请选择区域',
          allowClear: true,
          showSearch: true,
          filterOption: filterOptionByVisibleText,
          popupClassName: 'supplier-search-select-dropdown',
        },
      },
      {
        fieldName: 'purchaser',
        label: '采购员',
        component: 'ErpLazyPageSelect',
        componentProps: {
          api: getSupplierAssignableUsersPage,
          labelField: 'nickname',
          valueField: 'id',
          placeholder: '请选择采购员',
          allowClear: true,
          showSearch: true,
          filterOption: filterOptionByVisibleText,
          popupClassName: 'supplier-search-select-dropdown',
        },
      },
      {
        fieldName: 'category',
        label: '供应商类别',
        component: 'ErpLazyPageSelect',
        componentProps: {
          api: (params: any) =>
            getSupplierBaseOptionsPage({
              ...params,
              type: 'supplier_category',
              status: 0,
            }),
          labelField: 'name',
          valueField: 'name',
          placeholder: '请选择供应商类别',
          allowClear: true,
          showSearch: true,
          filterOption: filterOptionByVisibleText,
          popupClassName: 'supplier-search-select-dropdown',
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
        component: 'ErpLazyPageSelect',
        componentProps: {
          api: getSupplierAssignableUsersPage,
          labelField: 'nickname',
          valueField: 'id',
          placeholder: '请选择创建人',
          allowClear: true,
          showSearch: true,
          filterOption: filterOptionByVisibleText,
          popupClassName: 'supplier-search-select-dropdown',
        },
      },
    ],
    hiddenFields,
  );
}

/** 鍒楄〃鐨勫瓧娈?*/
export function useGridColumns(
  hiddenFields: string[] = [],
  rows: Record<string, any>[] = [],
): VxeTableGridOptions['columns'] {
  return prepareErpArchiveListColumns(
    applyPurchaseGridColumnPermission(
      [
        {
          type: 'checkbox',
          width: 50,
        },
        {
          field: 'contactListAction',
          title: '联系人',
          minWidth: 90,
          slots: { default: 'contactListAction' },
        },
        {
          field: 'supplierPortalAction',
          title: '供应商门户',
          minWidth: 110,
          slots: { default: 'supplierPortalAction' },
        },
        {
          field: 'code',
          title: '编码',
          minWidth: 120,
          sortable: true,
        },
        {
          field: 'name',
          title: '名称',
          minWidth: 150,
          sortable: true,
          slots: { default: 'name' },
        },
        {
          field: 'enterpriseMatch',
          title: '企业匹配',
          minWidth: 100,
          slots: { default: 'enterpriseMatch' },
        },
        {
          field: 'status',
          title: '状态',
          minWidth: 100,
          sortable: true,
          slots: { default: 'status' },
        },
        {
          field: 'wechatService',
          title: '微信客服',
          minWidth: 100,
          slots: { default: 'wechatService' },
        },
        {
          field: 'region',
          title: '区域',
          minWidth: 100,
          sortable: true,
        },
        {
          field: 'address',
          title: '地址',
          minWidth: 180,
          sortable: true,
          showOverflow: 'tooltip',
        },
        {
          field: 'remark',
          title: '备注',
          minWidth: 150,
          sortable: true,
          showOverflow: 'tooltip',
        },
        {
          field: 'creatorName',
          title: '创建人',
          minWidth: 120,
        },
        {
          field: 'createTime',
          title: '创建时间',
          minWidth: 160,
          formatter: 'formatDateTime',
          sortable: true,
        },
        {
          field: 'contactInfo',
          title: '联系方式',
          minWidth: 130,
          sortable: true,
          formatter: ({ row }: { row: any }) =>
            row.mobile || row.telephone || '-',
        },
        {
          field: 'purchaser',
          title: '采购员',
          minWidth: 120,
          sortable: true,
        },
        {
          field: 'accountSetName',
          title: '关联账套',
          minWidth: 120,
          slots: { default: 'accountSetName' },
        },
        {
          field: 'creditLimit',
          title: '白条授信',
          minWidth: 120,
          align: 'right',
          slots: { default: 'creditLimit' },
        },
        {
          field: 'actions',
          title: '操作',
          width: 106,
          fixed: 'right',
          slots: { default: 'actions' },
        },
      ],
      hiddenFields,
      {
        contactListAction: ['contact'],
      },
    ) ?? [],
    rows,
  );
}
