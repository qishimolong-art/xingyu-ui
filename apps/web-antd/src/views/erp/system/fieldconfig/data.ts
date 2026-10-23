/** Module item. */
export interface ModuleItem {
  key: string;
  label: string;
}

/** Module group. */
export interface ModuleGroup {
  groupKey: string;
  groupLabel: string;
  children: ModuleItem[];
}

/** Field configuration module groups. */
export function useModuleGroups(): ModuleGroup[] {
  return [
    {
      groupKey: 'parts_basic',
      groupLabel: '配件基本信息',
      children: [
        { key: 'erp_product', label: '配件信息' },
        { key: 'erp_product_category', label: '配件分类' },
        { key: 'erp_product_brand', label: '配件品牌' },
        { key: 'erp_product_unit', label: '配件单位' },
      ],
    },
    {
      groupKey: 'product',
      groupLabel: '产品管理',
      children: [{ key: 'erp_price_system', label: '价格体系' }],
    },
    {
      groupKey: 'base',
      groupLabel: '基础资料',
      children: [
        { key: 'erp_base_data', label: '基础选项' },
        { key: 'erp_warehouse', label: '仓库信息' },
      ],
    },
    {
      groupKey: 'purchase',
      groupLabel: '采购管理',
      children: [
        { key: 'purchase_order', label: '采购订单' },
        { key: 'purchase_in', label: '采购入库' },
        { key: 'purchase_return', label: '采购退货' },
        { key: 'purchase_invoice', label: '采购票据' },
        { key: 'purchase_price_adjust', label: '采购价格调整' },
        { key: 'supplier', label: '供应商' },
      ],
    },
    {
      groupKey: 'sale',
      groupLabel: '销售管理',
      children: [
        { key: 'customer', label: '客户' },
        { key: 'sale_quote', label: '报价订单' },
        { key: 'sale_order', label: '销售订单' },
        { key: 'sale_cart', label: '销售购物车' },
        { key: 'sale_out', label: '销售出库' },
        { key: 'sale_return', label: '销售退货' },
        { key: 'sale_price_adjust', label: '销售价格调整' },
        { key: 'erp_sale_config', label: '销售配置' },
      ],
    },
    {
      groupKey: 'stock',
      groupLabel: '库存管理',
      children: [
        { key: 'erp_stock_in', label: '其它入库' },
        { key: 'erp_stock_out', label: '其它出库' },
        { key: 'erp_stock_move', label: '库存调拨（历史只读）' },
        { key: 'erp_stock_check', label: '库存盘点' },
        { key: 'erp_stock', label: '产品库存' },
      ],
    },
    {
      groupKey: 'finance',
      groupLabel: '资金管理',
      children: [
        { key: 'erp_account', label: '账户信息' },
        { key: 'erp_finance_payment', label: '付款单' },
        { key: 'erp_finance_receipt', label: '收款单' },
        { key: 'erp_finance_transfer', label: '转账单' },
        { key: 'erp_finance_payable_expense', label: '费用支出' },
        { key: 'erp_finance_payable_other', label: '其它应付' },
        { key: 'erp_finance_receivable_other_income', label: '其它收入' },
        { key: 'erp_finance_receivable_other', label: '其它应收' },
      ],
    },
    {
      groupKey: 'accounting',
      groupLabel: '财务核算',
      children: [
        { key: 'erp_accounting_subject', label: '会计科目' },
        { key: 'erp_accounting_voucher_word', label: '凭证字' },
        { key: 'erp_accounting_voucher', label: '凭证列表' },
        { key: 'erp_accounting_voucher_attribution', label: '凭证生成' },
        { key: 'erp_accounting_book_open', label: '系统开账' },
        { key: 'erp_accounting_pre_receipt', label: '预收款单' },
        { key: 'erp_accounting_pre_payment', label: '预付款单' },
        { key: 'erp_accounting_pre_receivable', label: '预收账款单' },
        { key: 'erp_accounting_other_receivable', label: '其它应收单' },
        { key: 'erp_accounting_other_payable', label: '其它应付单' },
        { key: 'erp_accounting_report_template', label: '报表模板' },
      ],
    },
  ];
}

/** Compatibility helper: flatten groups to the legacy tab array shape. */
export function useModuleTabs() {
  return useModuleGroups().flatMap((g) => g.children);
}
