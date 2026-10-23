import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function read(relativePath: string) {
  return readFileSync(join(currentDir, relativePath), 'utf8');
}

describe('销售单据库存选择前置校验', () => {
  it('报价订单复制时显式保留来源业务部门', () => {
    const source = read('quote/modules/form.vue');

    expect(source).toContain(
      'loadCustomerSaleDeptOptions(copyData.customerId, copyData.deptId)',
    );
    expect(source).not.toContain('isCopy ? undefined : formData.value.deptId');
  });

  it.each([
    [
      '报价订单',
      'quote/modules/item-form.vue',
      'SALE_QUOTE_ALL_PRODUCT_PERMISSION',
      'erp:sale-quote:all-product',
      'props.mainDeptId',
    ],
    [
      '销售手推车',
      'cart/modules/item-form.vue',
      'SALE_CART_ALL_PRODUCT_PERMISSION',
      'erp:sale-cart:all-product',
      'props.deptId',
    ],
    [
      '销售订单',
      'order/modules/item-form.vue',
      'SALE_ORDER_ALL_PRODUCT_PERMISSION',
      'erp:sale-order:all-product',
      'props.mainDeptId',
    ],
    [
      '销售退货明细',
      'return/modules/item-form.vue',
      'SALE_RETURN_ALL_PRODUCT_PERMISSION',
      'erp:sale-return:all-product',
      'props.mainDeptId',
    ],
  ])(
    '%s 使用行内库存下拉并透传销售库存权限',
    (_, path, constName, permission, saleDeptIdExpression) => {
      const source = read(path);

      expect(source).toContain('ErpInlineStockSelect');
      expect(source).toContain(`settings-scope="sale-${path.split('/')[0]}"`);
      expect(source).toContain('getSaleStockPage');
      expect(source).toContain('getAllSaleProductWarehouseParams');
      expect(source).toContain(`allSaleProductPermission: ${constName}`);
      expect(source).toContain(`saleDeptId: ${saleDeptIdExpression}`);
      expect(source).toContain(permission);
      expect(source).toContain(':stock-page-api="getSaleStockPage"');
      expect(source).toContain(
        ':stock-page-params="getInlineStockPageParams()"',
      );
      expect(source).toContain(':filter-by-dept="false"');
      expect(source).not.toContain('void handleOpenSelect();');
    },
  );

  it('共享销售库存弹窗按表单权限申请全部商品销售范围', () => {
    const source = read('components/SaleStockProductSelectModal.vue');

    expect(source).toContain('allSaleProductPermission?: string');
    expect(source).toContain(
      'hasAccessByCodes([props.allSaleProductPermission])',
    );
    expect(source).toContain('allSaleProduct: true');
    expect(source).toContain(
      'allSaleProductPermission: props.allSaleProductPermission',
    );
  });

  it.each([
    [
      '报价订单',
      'quote/modules/item-form.vue',
      'SALE_QUOTE_ALL_PRODUCT_PERMISSION',
      'erp:sale-quote:all-product',
    ],
    [
      '销售手推车',
      'cart/modules/item-form.vue',
      'SALE_CART_ALL_PRODUCT_PERMISSION',
      'erp:sale-cart:all-product',
    ],
    [
      '销售订单',
      'order/modules/item-form.vue',
      'SALE_ORDER_ALL_PRODUCT_PERMISSION',
      'erp:sale-order:all-product',
    ],
    [
      '销售退货明细',
      'return/modules/item-form.vue',
      'SALE_RETURN_ALL_PRODUCT_PERMISSION',
      'erp:sale-return:all-product',
    ],
  ])(
    '%s 库存选择及保留的仓库查询按表单权限申请销售范围',
    (_, path, constName, permission) => {
      const source = read(path);

      expect(source).toContain(`const ${constName} = '${permission}'`);
      expect(source).toContain('function getAllSaleProductWarehouseParams()');
      expect(source).toContain(`hasAccessByCodes([${constName}])`);
      expect(source).toContain(`allSaleProductPermission: ${constName}`);
      if (path.startsWith('cart/') || path.startsWith('return/')) {
        expect(source).toMatch(
          /getSaleWarehouseSimplePage\(\{[\s\S]*getAllSaleProductWarehouseParams\(\)/,
        );
      } else {
        expect(source).not.toContain('v-model:value="row.warehouseId"');
        expect(source).toContain(
          ':stock-page-params="getInlineStockPageParams()"',
        );
      }
    },
  );

  it('共享库存弹窗不再回退到登录人部门', () => {
    const source = read('../components/StockProductSelectModal.vue');

    expect(source).toContain('return props.saleDeptId ?? props.deptId;');
    expect(source).not.toContain('userStore.userInfo?.deptId');
    expect(source).toContain('请先选择客户及所属部门，再选择库存');
  });
});
