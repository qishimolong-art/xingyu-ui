import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { getBaseDataSimpleList } from '#/api/erp/base';
import { getAccountSimplePage } from '#/api/erp/finance/account';
import {
  getFinanceTransferDeptSimplePage,
  getFinanceTransferUserSimplePage,
} from '#/api/erp/finance/transfer';
import { getRangePickerDefaultProps } from '#/utils';
import { prepareFinanceDocumentListColumns } from '#/views/erp/finance/utils/document-list-table';
import { applyFinanceFormFieldPermission } from '#/views/erp/finance/utils/field-permission';
import {
  createOptionalNumberRule,
  createRequiredNumberRule,
} from '#/views/erp/finance/utils/text-number';

const BANK_TRANSFER_FEE_EXPENSE_CATEGORY = 'bank_transfer_fee_expense_category';

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
        dependencies: {
          triggerFields: [''],
          show: () => false,
        },
      },
      {
        fieldName: 'no',
        label: '单据编号',
        component: 'Input',
        componentProps: {
          placeholder: '系统自动生成',
          disabled: true,
        },
      },
      {
        fieldName: 'transferTime',
        label: '转账时间',
        component: 'DatePicker',
        componentProps: {
          disabled,
          placeholder: '请选择转账时间',
          showTime: true,
          format: 'YYYY-MM-DD HH:mm:ss',
          valueFormat: 'x',
        },
        rules: 'required',
      },
      {
        fieldName: 'voucherNo',
        label: '凭证号',
        component: 'Input',
        componentProps: {
          placeholder: '审核后生成/回显',
          disabled: true,
        },
      },
      {
        fieldName: 'transferPrice',
        label: '转账金额',
        component: 'DecimalAmountInput',
        componentProps: {
          disabled,
          placeholder: '请输入转账金额',
          class: 'w-full',

          inputMode: 'decimal',
        },
        rules: createRequiredNumberRule('转账金额', {
          min: 0.01,
        }),
      },
      {
        fieldName: 'exchangeRate',
        label: '汇率',
        component: 'Input',
        componentProps: {
          disabled,
          placeholder: '请输入汇率',
          class: 'w-full',

          inputMode: 'decimal',
        },
        defaultValue: 1,
        rules: createRequiredNumberRule('汇率', {
          min: 0.000_001,
          integerDigits: 12,
        }),
      },
      {
        fieldName: 'financeUserId',
        label: '经手人',
        component: 'ErpLazyPageSelect',
        componentProps: {
          disabled,
          placeholder: '请选择经手人',
          allowClear: true,
          showSearch: true,
          api: getFinanceTransferUserSimplePage,
          pageSize: 10,
          labelField: 'nickname',
          valueField: 'id',
          popupClassName: 'bank-transfer-form-select-dropdown',
        },
        rules: 'required',
      },
      {
        fieldName: 'deptId',
        label: '所属部门',
        component: 'ErpLazyPageSelect',
        componentProps: {
          disabled,
          placeholder: '请选择所属部门',
          allowClear: true,
          showSearch: true,
          api: getFinanceTransferDeptSimplePage,
          pageSize: 10,
          labelField: 'name',
          valueField: 'id',
          popupClassName: 'bank-transfer-form-select-dropdown',
        },
        rules: 'required',
      },
      {
        fieldName: 'feePrice',
        label: '手续费',
        component: 'DecimalAmountInput',
        componentProps: {
          disabled,
          placeholder: '请输入手续费',
          class: 'w-full',

          inputMode: 'decimal',
        },
        defaultValue: 0,
        rules: createOptionalNumberRule('手续费', { min: 0 }),
      },
      {
        fieldName: 'feeExpenseCategory',
        label: '费用项目',
        component: 'ApiSelect',
        componentProps: {
          disabled,
          placeholder: '请选择费用项目',
          allowClear: true,
          showSearch: true,
          api: () => getBaseDataSimpleList(BANK_TRANSFER_FEE_EXPENSE_CATEGORY),
          labelField: 'name',
          valueField: 'name',
          popupClassName: 'bank-transfer-form-select-dropdown',
        },
      },
      {
        component: 'Divider',
        fieldName: 'outAccountDivider',
        label: '',
        renderComponentContent: () => ({
          default: () => ['转出账户信息'],
        }),
        formItemClass: 'col-span-4 bank-transfer-form__divider',
      },
      {
        fieldName: 'outAccountId',
        label: '转出账户',
        component: 'ErpLazyPageSelect',
        componentProps: {
          disabled,
          placeholder: '请选择转出账户',
          allowClear: true,
          showSearch: true,
          api: getAccountSimplePage,
          pageSize: 10,
          labelField: 'name',
          valueField: 'id',
          popupClassName: 'bank-transfer-form-select-dropdown',
        },
        rules: 'required',
      },
      {
        fieldName: 'outAccountBalance',
        label: '转出余额',
        component: 'DecimalAmountInput',
        componentProps: {
          disabled: true,
          placeholder: '选择转出账户后自动带出',
        },
      },
      {
        fieldName: 'outAccountBankName',
        label: '开户行',
        component: 'Input',
        componentProps: {
          disabled: true,
          placeholder: '选择转出账户后自动带出',
        },
      },
      {
        fieldName: 'outAccountBankAccount',
        label: '银行账号',
        component: 'Input',
        componentProps: {
          disabled: true,
          placeholder: '选择转出账户后自动带出',
        },
      },
      {
        component: 'Divider',
        fieldName: 'inAccountDivider',
        label: '',
        renderComponentContent: () => ({
          default: () => ['转入账户信息'],
        }),
        formItemClass: 'col-span-4 bank-transfer-form__divider',
      },
      {
        fieldName: 'inAccountId',
        label: '转入账户',
        component: 'ErpLazyPageSelect',
        componentProps: {
          disabled,
          placeholder: '请选择转入账户',
          allowClear: true,
          showSearch: true,
          api: getAccountSimplePage,
          pageSize: 10,
          labelField: 'name',
          valueField: 'id',
          popupClassName: 'bank-transfer-form-select-dropdown',
        },
        rules: 'required',
      },
      {
        fieldName: 'inAccountBalance',
        label: '转入余额',
        component: 'DecimalAmountInput',
        componentProps: {
          disabled: true,
          placeholder: '选择转入账户后自动带出',
        },
      },
      {
        fieldName: 'inAccountBankName',
        label: '开户行',
        component: 'Input',
        componentProps: {
          disabled: true,
          placeholder: '选择转入账户后自动带出',
        },
      },
      {
        fieldName: 'inAccountBankAccount',
        label: '银行账号',
        component: 'Input',
        componentProps: {
          disabled: true,
          placeholder: '选择转入账户后自动带出',
        },
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Textarea',
        componentProps: {
          disabled: formType === 'detail',
          placeholder: '请输入备注',
          autoSize: { minRows: 1, maxRows: 2 },
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
          showDescription: formType !== 'detail',
          disabled: formType === 'detail',
        },
        formItemClass: 'col-span-4',
      },
      {
        fieldName: 'creatorName',
        label: '创建人',
        component: 'Input',
        componentProps: { disabled: true },
        dependencies: { triggerFields: ['id'], show: (values) => !!values.id },
      },
      {
        fieldName: 'createTime',
        label: '创建时间',
        component: 'DatePicker',
        componentProps: {
          disabled: true,
          showTime: true,
          format: 'YYYY-MM-DD HH:mm:ss',
        },
        dependencies: { triggerFields: ['id'], show: (values) => !!values.id },
      },
      {
        fieldName: 'updaterName',
        label: '修改人',
        component: 'Input',
        componentProps: { disabled: true },
        dependencies: { triggerFields: ['id'], show: (values) => !!values.id },
      },
      {
        fieldName: 'updateTime',
        label: '修改时间',
        component: 'DatePicker',
        componentProps: {
          disabled: true,
          showTime: true,
          format: 'YYYY-MM-DD HH:mm:ss',
        },
        dependencies: { triggerFields: ['id'], show: (values) => !!values.id },
      },
    ],
    hiddenFields,
  );
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'inAccountId',
      label: '转入账户',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择转入账户',
        allowClear: true,
        showSearch: true,
        api: getAccountSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        popupClassName: 'bank-transfer-search-select-dropdown',
        loadErrorMessage: '账户列表加载失败，请重试',
      },
    },
    {
      fieldName: 'outAccountId',
      label: '转出账户',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择转出账户',
        allowClear: true,
        showSearch: true,
        api: getAccountSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        popupClassName: 'bank-transfer-search-select-dropdown',
        loadErrorMessage: '账户列表加载失败，请重试',
      },
    },
    {
      fieldName: 'transferTime',
      label: '转账时间',
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
        api: getFinanceTransferDeptSimplePage,
        pageSize: 10,
        labelField: 'name',
        valueField: 'id',
        popupClassName: 'bank-transfer-search-select-dropdown',
        loadErrorMessage: '部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'no',
      label: '转账单号',
      component: 'Input',
      componentProps: {
        placeholder: '请输入转账单号',
        allowClear: true,
      },
    },
    {
      fieldName: 'financeUserId',
      label: '财务人员',
      component: 'ErpLazyPageSelect',
      componentProps: {
        placeholder: '请选择财务人员',
        allowClear: true,
        showSearch: true,
        api: getFinanceTransferUserSimplePage,
        pageSize: 10,
        labelField: 'nickname',
        valueField: 'id',
        popupClassName: 'bank-transfer-search-select-dropdown',
        loadErrorMessage: '财务人员列表加载失败，请重试',
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
      {
        type: 'checkbox',
        width: 36,
      },
      {
        field: 'printAction',
        title: '打印',
        width: 40,
        slots: { default: 'printAction' },
      },
      {
        field: 'deleteAction',
        title: '删除',
        width: 40,
        slots: { default: 'deleteAction' },
      },
      {
        field: 'no',
        title: '单号',
        width: 132,
        slots: { default: 'bankTransferNo' },
      },
      {
        field: 'transferTime',
        title: '日期',
        width: 100,
        formatter: 'formatDate',
      },
      {
        field: 'transferPrice',
        title: '金额',
        formatter: 'formatAmount2',
        width: 96,
        align: 'right',
        headerAlign: 'right',
        className:
          'bank-transfer-amount-cell bank-transfer-amount-cell--primary',
      },
      {
        field: 'outAccountName',
        title: '转出账户',
        width: 132,
        showOverflow: 'tooltip',
      },
      {
        field: 'inAccountName',
        title: '转入账户',
        width: 132,
        showOverflow: 'tooltip',
      },
      {
        field: 'status',
        title: '状态',
        width: 76,
        slots: { default: 'status' },
      },
      {
        field: 'financeUserName',
        title: '经手人',
        width: 84,
        showOverflow: 'tooltip',
      },
      {
        field: 'auditorName',
        title: '审核人',
        width: 84,
        showOverflow: 'tooltip',
      },
      {
        field: 'auditTime',
        title: '审核日期',
        width: 112,
        formatter: 'formatDateTime',
      },
      {
        field: 'voucherNo',
        title: '凭证号',
        width: 120,
        showOverflow: 'tooltip',
      },
      {
        field: 'remark',
        title: '备注',
        minWidth: 152,
        showOverflow: 'tooltip',
      },
      {
        title: '操作',
        width: 164,
        fixed: 'right',
        slots: { default: 'actions' },
      },
    ],
    rows,
  );
}
