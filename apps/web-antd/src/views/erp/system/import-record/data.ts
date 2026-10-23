import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { getRangePickerDefaultProps } from '#/utils';

export const recordStatusOptions = [
  { label: '处理中', value: 'PROCESSING' },
  { label: '成功', value: 'SUCCESS' },
  { label: '部分成功', value: 'PARTIAL_SUCCESS' },
  { label: '失败', value: 'FAILURE' },
];

export const moduleOptions = [
  { label: '配件信息', value: 'erp_product' },
  { label: '配件分类', value: 'erp_product_category' },
  { label: '配件单位', value: 'erp_product_unit' },
  { label: '仓库', value: 'erp_warehouse' },
  { label: '产品库存', value: 'erp_stock' },
  { label: '库存流水', value: 'erp_stock_record' },
  { label: '其它入库', value: 'erp_stock_in' },
  { label: '其它出库', value: 'erp_stock_out' },
  { label: '库存调拨（历史）', value: 'erp_stock_move' },
  { label: '库存盘点', value: 'erp_stock_check' },
  { label: '入仓单', value: 'erp_stock_in_bill' },
  { label: '出仓单', value: 'erp_stock_out_bill' },
  { label: '供应商', value: 'erp_supplier' },
  { label: '采购订单', value: 'erp_purchase_order' },
  { label: '采购入库', value: 'erp_purchase_in' },
  { label: '采购退货', value: 'erp_purchase_return' },
  { label: '采购调价', value: 'erp_purchase_price_adjust' },
  { label: '采购票据', value: 'erp_purchase_invoice' },
  { label: '客户', value: 'erp_customer' },
  { label: '销售报价', value: 'erp_sale_quote' },
  { label: '销售手推车', value: 'erp_sale_cart' },
  { label: '销售订单', value: 'erp_sale_order' },
  { label: '销售单', value: 'erp_sale_out' },
  { label: '销售退货', value: 'erp_sale_return' },
  { label: '销售调价', value: 'erp_sale_price_adjust' },
  { label: '结算账户', value: 'erp_account' },
  { label: '收款单', value: 'erp_finance_receipt' },
  { label: '付款单', value: 'erp_finance_payment' },
  { label: '银行转账', value: 'erp_finance_transfer' },
  { label: '费用支付', value: 'erp_payable_expense' },
  { label: '其他应付', value: 'erp_payable_other' },
  { label: '其他应收', value: 'erp_receivable_other' },
  { label: '其他收入', value: 'erp_receivable_other_income' },
  { label: '应收账款', value: 'erp_receivable_account' },
  { label: '应收冲应付', value: 'erp_settlement_offset' },
  { label: '会计科目', value: 'erp_accounting_subject' },
  { label: '凭证', value: 'erp_voucher' },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'moduleKey',
      label: '模块',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: moduleOptions,
      },
    },
    {
      fieldName: 'fileName',
      label: '文件名',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入文件名' },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: recordStatusOptions,
      },
    },
    {
      fieldName: 'createTime',
      label: '导入时间',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
  ];
}

export function useGridColumns(): VxeTableGridOptions['columns'] {
  return [
    { type: 'seq', title: '序号', width: 60, fixed: 'left' },
    { field: 'moduleName', title: '模块', width: 120 },
    { field: 'fileName', title: '文件名', minWidth: 180 },
    {
      field: 'status',
      title: '状态',
      width: 110,
      slots: { default: 'status' },
    },
    { field: 'totalCount', title: '总数', width: 90 },
    { field: 'successCount', title: '成功', width: 90 },
    { field: 'failureCount', title: '失败', width: 90 },
    { field: 'createCount', title: '新增', width: 90 },
    { field: 'updateCount', title: '更新', width: 90 },
    { field: 'operatorName', title: '操作人', width: 120 },
    {
      field: 'durationMs',
      title: '耗时',
      width: 100,
      slots: { default: 'duration' },
    },
    {
      field: 'createTime',
      title: '导入时间',
      width: 170,
      formatter: 'formatDateTime',
    },
    {
      field: 'action',
      title: '操作',
      width: 90,
      fixed: 'right',
      slots: { default: 'action' },
    },
  ];
}
