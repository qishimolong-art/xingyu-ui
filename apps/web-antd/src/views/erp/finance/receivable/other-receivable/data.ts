import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import {
  getOtherReceivableDeptSimplePage,
  getOtherReceivableUserSimplePage,
} from '#/api/erp/finance/receivable/other-receivable';
import { getSimpleUserList } from '#/api/system/user';
import { getRangePickerDefaultProps } from '#/utils';
import { getOtherReceivableCustomerDeptTree } from '#/views/erp/finance/utils/dept';
import { prepareFinanceDocumentListColumns } from '#/views/erp/finance/utils/document-list-table';
import { applyFinanceFormFieldPermission } from '#/views/erp/finance/utils/field-permission';
import { createOptionalNumberRule } from '#/views/erp/finance/utils/text-number';
import { getCustomerSelectProps } from '#/views/erp/sale/utils/customer-select';

export function useFormSchema(
  formType: string,
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  const disabled = formType === 'detail';
  return applyFinanceFormFieldPermission(
    [
      {
        fieldName: 'id',
        component: 'Input',
        dependencies: { triggerFields: [''], show: () => false },
      },
      {
        fieldName: 'no',
        label: '单据编号',
        component: 'Input',
        componentProps: { placeholder: '系统自动生成', disabled: true },
      },
      {
        fieldName: 'sourceType',
        label: '来源类型',
        component: 'Input',
        componentProps: {
          placeholder: '固定为调账',
          disabled: true,
          maxlength: 64,
        },
        defaultValue: '调账',
      },
      {
        fieldName: 'customerId',
        label: '客户',
        component: 'CustomerLazySelect',
        componentProps: getCustomerSelectProps(
          disabled,
          'other-receivable-form-select-dropdown',
        ),
        rules: 'required',
      },
      {
        fieldName: 'bizTime',
        label: '开单日期',
        component: 'DatePicker',
        componentProps: {
          placeholder: '系统自动生成',
          disabled: true,
          format: 'YYYY-MM-DD',
          valueFormat: 'YYYY-MM-DD',
        },
        rules: 'required',
      },
      {
        fieldName: 'creatorName',
        label: '创建人',
        component: 'Input',
        componentProps: {
          placeholder: '系统自动生成',
          disabled: true,
        },
      },
      {
        fieldName: 'handlerId',
        label: '经手人',
        component: 'ApiSelect',
        componentProps: {
          placeholder: '请选择经手人',
          disabled,
          allowClear: true,
          showSearch: true,
          api: getSimpleUserList,
          labelField: 'nickname',
          valueField: 'id',
          popupClassName: 'other-receivable-form-select-dropdown',
        },
      },
      {
        fieldName: 'voucherNo',
        label: '凭证号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入凭证号',
          disabled,
          maxlength: 64,
        },
      },
      {
        fieldName: 'receivableAmount',
        label: '应收金额',
        component: 'DecimalAmountInput',
        componentProps: {
          placeholder: '请输入应收金额',
          disabled,
          class: 'w-full',

          inputMode: 'decimal',
        },
        rules: createOptionalNumberRule('应收金额', {
          nonZero: true,

          required: true,
        }),
      },
      {
        fieldName: 'settledAmount',
        label: '已结金额',
        component: 'DecimalAmountInput',
        componentProps: {
          placeholder: '请输入已结金额',
          disabled,
          class: 'w-full',

          inputMode: 'decimal',
        },
        rules: createOptionalNumberRule('已结金额', { min: 0 }),
        defaultValue: 0,
      },
      {
        fieldName: 'deptId',
        label: '部门',
        component: 'ApiTreeSelect',
        componentProps: {
          placeholder: '请选择部门',
          disabled,
          allowClear: true,
          showSearch: true,
          api: getOtherReceivableCustomerDeptTree,
          params: {},
          shouldFetch: (params: { customerId?: number | string }) =>
            Boolean(params?.customerId),
          labelField: 'name',
          valueField: 'id',
          childrenField: 'children',
          popupClassName: 'other-receivable-form-select-dropdown',
        },
        rules: 'required',
      },
      {
        fieldName: 'project',
        label: '项目',
        component: 'Select',
        componentProps: {
          placeholder: '请选择项目',
          disabled,
          allowClear: true,
          options: [{ label: '代垫运费', value: '代垫运费' }],
        },
      },
      {
        fieldName: 'sourceNo',
        label: '来源单号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入来源单号',
          disabled,
          maxlength: 64,
        },
      },
      {
        fieldName: 'receivableType',
        label: '应收类型',
        component: 'Select',
        componentProps: {
          placeholder: '请选择应收类型',
          disabled,
          allowClear: true,
          options: [{ label: '普通应收', value: '普通应收' }],
        },
        defaultValue: '普通应收',
      },
      {
        fieldName: 'costAmount',
        label: '成本金额',
        component: 'DecimalAmountInput',
        componentProps: {
          placeholder: '请输入成本金额',
          disabled,
          class: 'w-full',

          inputMode: 'decimal',
        },
        rules: createOptionalNumberRule('成本金额', { min: 0 }),
        defaultValue: 0,
      },
      {
        fieldName: 'isPaperNote',
        label: '是否纸质欠条',
        component: 'Switch',
        componentProps: {
          disabled,
          checkedChildren: '是',
          unCheckedChildren: '否',
        },
        defaultValue: false,
      },
      {
        fieldName: 'paperNoteDesc',
        label: '纸质欠条说明',
        component: 'Textarea',
        componentProps: {
          placeholder: '请输入纸质欠条说明',
          disabled,
          rows: 3,
          maxlength: 512,
        },
        formItemClass: 'col-span-4',
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Textarea',
        componentProps: {
          placeholder: '请输入备注',
          disabled,
          rows: 3,
          maxlength: 512,
        },
        formItemClass: 'col-span-4',
      },
      {
        fieldName: 'fileUrl',
        label: '附件',
        component: 'FileUpload',
        componentProps: {
          maxNumber: 1,
          maxSize: 10,
          accept: [
            'pdf',
            'doc',
            'docx',
            'xls',
            'xlsx',
            'txt',
            'jpg',
            'jpeg',
            'png',
          ],
          showDescription: !disabled,
          disabled,
        },
        formItemClass: 'col-span-4',
      },
    ],
    hiddenFields,
  );
}

export function useLegacyGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'no',
      label: '单据编号',
      component: 'Input',
      componentProps: { placeholder: '请输入单据编号', allowClear: true },
    },
    {
      fieldName: 'customerId',
      label: '客户',
      component: 'CustomerLazySelect',
      componentProps: getCustomerSelectProps(
        false,
        'other-receivable-search-select-dropdown',
      ),
    },
    {
      fieldName: 'deptId',
      label: '部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择部门',
        allowClear: true,
        showSearch: true,
        api: getOtherReceivableDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        popupClassName: 'other-receivable-search-select-dropdown',
        loadErrorMessage: '部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'handlerId',
      label: '经手人',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择经手人',
        allowClear: true,
        showSearch: true,
        api: getOtherReceivableUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        valueField: 'id',
        popupClassName: 'other-receivable-search-select-dropdown',
        loadErrorMessage: '经手人列表加载失败，请重试',
      },
    },
    {
      fieldName: 'bizTime',
      label: '业务日期',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    {
      fieldName: 'status',
      label: '审核状态',
      component: 'ApiSelect',
      componentProps: {
        placeholder: '请选择审核状态',
        allowClear: true,
        api: async () => [
          { label: '草稿', value: 0 },
          { label: '未审核', value: 10 },
          { label: '已审核', value: 20 },
        ],
        labelField: 'label',
        valueField: 'value',
      },
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'customerId',
      label: '\u5BA2\u6237',
      component: 'CustomerLazySelect',
      componentProps: getCustomerSelectProps(),
    },
    {
      fieldName: 'bizTime',
      label: '\u4E1A\u52A1\u65E5\u671F',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    {
      fieldName: 'deptId',
      label: '\u6240\u5C5E\u90E8\u95E8',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '\u8BF7\u9009\u62E9\u6240\u5C5E\u90E8\u95E8',
        allowClear: true,
        showSearch: true,
        api: getOtherReceivableDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        loadErrorMessage: '部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'no',
      label: '\u5355\u636E\u7F16\u53F7',
      component: 'Input',
      componentProps: {
        placeholder: '\u8BF7\u8F93\u5165\u5355\u636E\u7F16\u53F7',
        allowClear: true,
      },
    },
    {
      fieldName: 'creator',
      label: '\u521B\u5EFA\u4EBA',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '\u8BF7\u9009\u62E9\u521B\u5EFA\u4EBA',
        allowClear: true,
        showSearch: true,
        api: getOtherReceivableUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        valueField: 'id',
        loadErrorMessage: '创建人列表加载失败，请重试',
      },
    },
    {
      fieldName: 'handlerId',
      label: '\u7ECF\u624B\u4EBA',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '\u8BF7\u9009\u62E9\u7ECF\u624B\u4EBA',
        allowClear: true,
        showSearch: true,
        api: getOtherReceivableUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        valueField: 'id',
        loadErrorMessage: '经手人列表加载失败，请重试',
      },
    },
    {
      fieldName: 'remark',
      label: '\u5907\u6CE8',
      component: 'Input',
      componentProps: {
        placeholder: '\u8BF7\u8F93\u5165\u5907\u6CE8',
        allowClear: true,
      },
    },
    {
      fieldName: 'status',
      label: '\u72B6\u6001',
      component: 'ApiSelect',
      componentProps: {
        placeholder: '\u8BF7\u9009\u62E9\u72B6\u6001',
        allowClear: true,
        api: async () => [
          { label: '\u8349\u7A3F', value: 0 },
          { label: '\u672A\u5BA1\u6838', value: 10 },
          { label: '\u5DF2\u5BA1\u6838', value: 20 },
        ],
        labelField: 'label',
        valueField: 'value',
      },
    },
  ];
}

export function useGridColumns(
  rows: Record<string, any>[] = [],
): NonNullable<VxeTableGridOptions['columns']> {
  return prepareFinanceDocumentListColumns(
    [
      { type: 'checkbox', width: 42 },
      {
        field: 'deleteAction',
        title: '删除',
        width: 40,
        slots: { default: 'deleteAction' },
      },
      {
        field: 'printAction',
        title: '打印',
        width: 40,
        slots: { default: 'printAction' },
      },
      {
        field: 'no',
        title: '单号',
        width: 132,
        slots: { default: 'otherReceivableNo' },
      },
      {
        field: 'bizTime',
        title: '日期',
        width: 104,
        formatter: 'formatDate',
      },
      {
        field: 'receivableAmount',
        title: '应收金额',
        width: 112,
        align: 'right',
        headerAlign: 'right',
        className:
          'other-receivable-amount-cell other-receivable-amount-cell--primary',
        formatter: 'formatAmount2',
      },
      {
        field: 'increaseReceivableAmount',
        title: '增加应收',
        width: 112,
        align: 'right',
        headerAlign: 'right',
        className: 'other-receivable-amount-cell',
        formatter: 'formatAmount2',
      },
      {
        field: 'settledAmount',
        title: '已结金额',
        width: 112,
        align: 'right',
        headerAlign: 'right',
        className: 'other-receivable-amount-cell',
        formatter: 'formatAmount2',
      },
      { field: 'sourceType', title: '来源类型', width: 100 },
      {
        field: 'status',
        title: '状态',
        width: 84,
        slots: { default: 'status' },
      },
      { field: 'voucherNo', title: '凭证号', width: 120 },
      { field: 'customerName', title: '客户名称', width: 150 },
      { field: 'saleUserName', title: '业务员', width: 100 },
      { field: 'creatorName', title: '创建人', width: 100 },
      {
        field: 'createTime',
        title: '创建时间',
        width: 154,
        formatter: 'formatDateTime',
      },
      { field: 'auditorName', title: '审核人', width: 100 },
      {
        field: 'auditTime',
        title: '审核时间',
        width: 154,
        formatter: 'formatDateTime',
      },
      { field: 'handlerName', title: '经手人', width: 100 },
      { field: 'remark', title: '备注', width: 160 },
      { field: 'project', title: '项目', width: 120 },
      { field: 'deptName', title: '所属部门', width: 108 },
      {
        title: '操作',
        width: 168,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    rows,
  );
}
