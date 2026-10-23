import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import {
  getPayableOtherDeptSimplePage,
  getPayableOtherUserSimplePage,
} from '#/api/erp/finance/payable/other';
import { getSimpleUserList } from '#/api/system/user';
import { getRangePickerDefaultProps } from '#/utils';
import { getPayableOtherSupplierDeptTree } from '#/views/erp/finance/utils/dept';
import { prepareFinanceDocumentListColumns } from '#/views/erp/finance/utils/document-list-table';
import { applyFinanceFormFieldPermission } from '#/views/erp/finance/utils/field-permission';
import {
  createOptionalNumberRule,
  createRequiredNumberRule,
} from '#/views/erp/finance/utils/text-number';
import { getSupplierSelectProps } from '#/views/erp/purchase/utils/supplier-select';

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
        label: '账单编号',
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
        fieldName: 'supplierId',
        label: '供应商',
        component: 'SupplierLazySelect',
        componentProps: getSupplierSelectProps(
          disabled,
          'other-payable-form-select-dropdown',
        ),
        rules: 'required',
      },
      {
        fieldName: 'bizTime',
        label: '开单日期',
        component: 'DatePicker',
        componentProps: {
          placeholder: '请选择开单日期',
          disabled,
          format: 'YYYY-MM-DD',
          valueFormat: 'YYYY-MM-DD',
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
          popupClassName: 'other-payable-form-select-dropdown',
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
        fieldName: 'payableAmount',
        label: '应付金额',
        component: 'DecimalAmountInput',
        componentProps: {
          placeholder: '请输入应付金额',
          disabled,
          class: 'w-full',

          inputMode: 'decimal',
        },
        rules: createRequiredNumberRule('应付金额', {
          nonZero: true,
        }),
      },
      {
        fieldName: 'settledAmount',
        label: '已付金额',
        component: 'DecimalAmountInput',
        componentProps: {
          placeholder: '请输入已付金额',
          disabled,
          class: 'w-full',

          inputMode: 'decimal',
        },
        rules: createOptionalNumberRule('已付金额', {
          min: 0,
        }),
        defaultValue: 0,
      },
      {
        fieldName: 'project',
        label: '项目',
        component: 'Input',
        componentProps: {
          placeholder: '请输入项目',
          disabled,
          maxlength: 128,
        },
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
          api: getPayableOtherSupplierDeptTree,
          params: {},
          shouldFetch: (params: { supplierId?: number | string }) =>
            Boolean(params?.supplierId),
          labelField: 'name',
          valueField: 'id',
          childrenField: 'children',
          popupClassName: 'other-payable-form-select-dropdown',
        },
        rules: 'required',
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

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'supplierId',
      label: '供应商',
      component: 'SupplierLazySelect',
      componentProps: getSupplierSelectProps(
        false,
        'other-payable-search-select-dropdown',
      ),
    },
    {
      fieldName: 'bizTime',
      label: '开单日期',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    {
      fieldName: 'deptId',
      label: '所属部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择所属部门',
        allowClear: true,
        showSearch: true,
        api: getPayableOtherDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        popupClassName: 'other-payable-search-select-dropdown',
        loadErrorMessage: '部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'no',
      label: '单据编号',
      component: 'Input',
      componentProps: { placeholder: '请输入单据编号', allowClear: true },
    },
    {
      fieldName: 'creator',
      label: '创建人',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择创建人',
        allowClear: true,
        showSearch: true,
        api: getPayableOtherUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        valueField: 'id',
        popupClassName: 'other-payable-search-select-dropdown',
        loadErrorMessage: '创建人列表加载失败，请重试',
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
        api: getPayableOtherUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        valueField: 'id',
        popupClassName: 'other-payable-search-select-dropdown',
        loadErrorMessage: '经手人列表加载失败，请重试',
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
          { label: '\u8349\u7A3F', value: 0 },
          { label: '未审核', value: 10 },
          { label: '已审核', value: 20 },
        ],
        labelField: 'label',
        valueField: 'value',
        popupClassName: 'other-payable-search-select-dropdown',
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
        slots: { default: 'otherPayableNo' },
      },
      {
        field: 'bizTime',
        title: '日期',
        width: 104,
        formatter: 'formatDate',
      },
      {
        field: 'payableAmount',
        title: '应付金额',
        width: 112,
        align: 'right',
        headerAlign: 'right',
        className:
          'other-payable-amount-cell other-payable-amount-cell--primary',
        formatter: 'formatAmount2',
      },
      {
        field: 'increasePayableAmount',
        title: '增加应付',
        width: 112,
        align: 'right',
        headerAlign: 'right',
        className: 'other-payable-amount-cell',
        formatter: 'formatAmount2',
      },
      {
        field: 'settledAmount',
        title: '已结金额',
        width: 112,
        align: 'right',
        headerAlign: 'right',
        className: 'other-payable-amount-cell',
        formatter: 'formatAmount2',
      },
      { field: 'sourceType', title: '来源类型', width: 100 },
      { field: 'sourceNo', title: '来源单号', width: 130 },
      {
        field: 'status',
        title: '状态',
        width: 84,
        slots: { default: 'status' },
      },
      { field: 'voucherNo', title: '凭证号', width: 120 },
      { field: 'supplierName', title: '供应商名称', width: 150 },
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
