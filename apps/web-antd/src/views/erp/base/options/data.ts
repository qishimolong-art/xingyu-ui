export interface BaseOptionItem {
  key: string;
  title: string;
  type: string;
}

export interface BaseOptionForm {
  key: string;
  title: string;
  items: BaseOptionItem[];
}

export interface BaseOptionMenu {
  key: string;
  title: string;
  forms: BaseOptionForm[];
}

export const BASE_OPTION_GROUPS: BaseOptionMenu[] = [
  {
    key: 'base',
    title: '基础数据',
    forms: [
      {
        key: 'base_supplier',
        title: '供应商档案',
        items: [
          {
            key: 'base_supplier_category',
            title: '往来类别',
            type: 'supplier_category',
          },
          {
            key: 'base_supplier_supplier_type',
            title: '供应商类型',
            type: 'supplier_type',
          },
          { key: 'base_supplier_region', title: '区域', type: 'region' },
          {
            key: 'base_supplier_settle_method',
            title: '结算方式',
            type: 'settle_method',
          },
          {
            key: 'base_supplier_delivery_method',
            title: '送货方式',
            type: 'delivery_method',
          },
          {
            key: 'base_supplier_freight_type',
            title: '运费类型',
            type: 'freight_type',
          },
          {
            key: 'base_supplier_logistics_company',
            title: '物流公司',
            type: 'logistics_company',
          },
          {
            key: 'base_supplier_invoice_type',
            title: '开票类型',
            type: 'invoice_type',
          },
        ],
      },
      {
        key: 'base_customer',
        title: '客户档案',
        items: [
          {
            key: 'base_customer_category',
            title: '往来类别',
            type: 'customer_category',
          },
          {
            key: 'base_customer_customer_type',
            title: '客户类型',
            type: 'customer_type',
          },
          {
            key: 'base_customer_sales_area',
            title: '销售区域',
            type: 'sales_area',
          },
          {
            key: 'base_customer_price_level',
            title: '价格级别',
            type: 'price_level',
          },
          {
            key: 'base_customer_settle_method',
            title: '结算方式',
            type: 'settle_method',
          },
          {
            key: 'base_customer_invoice_type',
            title: '开票类型',
            type: 'invoice_type',
          },
          {
            key: 'base_customer_freight_type',
            title: '运费类型',
            type: 'freight_type',
          },
          {
            key: 'base_customer_delivery_method',
            title: '送货方式',
            type: 'delivery_method',
          },
          { key: 'base_customer_route', title: '线路', type: 'route' },
          {
            key: 'base_customer_freight_explain',
            title: '运费说明',
            type: 'freight_explain',
          },
        ],
      },
    ],
  },
  {
    key: 'purchase',
    title: '采购管理',
    forms: [
      {
        key: 'purchase_order',
        title: '采购订单',
        items: [
          {
            key: 'purchase_order_purchase_type',
            title: '采购方式',
            type: 'purchase_type',
          },
          {
            key: 'purchase_order_settle_method',
            title: '结算方式',
            type: 'settle_method',
          },
          {
            key: 'purchase_order_invoice_type',
            title: '开票类型',
            type: 'invoice_type',
          },
          {
            key: 'purchase_order_logistics_company',
            title: '物流公司',
            type: 'logistics_company',
          },
          {
            key: 'purchase_order_order_company',
            title: '订货公司',
            type: 'order_company',
          },
          {
            key: 'purchase_order_receive_address',
            title: '收货地址',
            type: 'receive_address',
          },
        ],
      },
    ],
  },
  {
    key: 'inventory',
    title: '库存管理',
    forms: [
      {
        key: 'inventory_storage',
        title: '仓储资料',
        items: [
          {
            key: 'inventory_storage_storage_center',
            title: '仓储中心',
            type: 'storage_center',
          },
          {
            key: 'inventory_storage_storage_warehouse',
            title: '仓储对应仓库',
            type: 'storage_warehouse',
          },
        ],
      },
    ],
  },
  {
    key: 'finance',
    title: '资金管理',
    forms: [
      {
        key: 'payable_expense',
        title: '费用支付',
        items: [
          {
            key: 'payable_expense_biz_type',
            title: '类型',
            type: 'payable_expense_biz_type',
          },
          {
            key: 'payable_expense_type',
            title: '支出类型',
            type: 'payable_expense_type',
          },
          {
            key: 'payable_expense_doc_type',
            title: '单据类型',
            type: 'payable_expense_doc_type',
          },
        ],
      },
      {
        key: 'bank_transfer',
        title: '银行转账',
        items: [
          {
            key: 'bank_transfer_fee_expense_category',
            title: '费用项目',
            type: 'bank_transfer_fee_expense_category',
          },
        ],
      },
    ],
  },
];

export const BASE_OPTION_ITEMS = BASE_OPTION_GROUPS.flatMap((menu) =>
  menu.forms.flatMap((form) => form.items),
);

export const BASE_OPTION_OPEN_KEYS = BASE_OPTION_GROUPS.flatMap((menu) => [
  menu.key,
  ...menu.forms.map((form) => form.key),
]);
