import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const purchaseOrderApiSource = readFileSync(
  join(currentDir, '../../../api/erp/purchase/order/index.ts'),
  'utf8',
);
const purchaseInApiSource = readFileSync(
  join(currentDir, '../../../api/erp/purchase/in/index.ts'),
  'utf8',
);
const purchaseOrderInableModalSource = readFileSync(
  join(currentDir, 'components/PurchaseOrderInableItemSelectModal.vue'),
  'utf8',
);
const purchaseOrderInModalSource = readFileSync(
  join(currentDir, 'order/modules/purchase-in-modal.vue'),
  'utf8',
);
const purchaseInFormSource = readFileSync(
  join(currentDir, 'in/modules/form.vue'),
  'utf8',
);
const transferOutFormSource = readFileSync(
  join(currentDir, 'in/modules/purchase-in-transfer-out-form.vue'),
  'utf8',
);

describe('purchase source item pagination contract', () => {
  it('adds paged source item APIs while keeping legacy list APIs', () => {
    expect(purchaseOrderApiSource).toContain(
      '/erp/purchase-order/inable-items',
    );
    expect(purchaseOrderApiSource).toContain(
      '/erp/purchase-order/inable-item-page',
    );
    expect(purchaseOrderApiSource).toContain('function getInableItemPage');
    expect(purchaseInApiSource).toContain(
      '/erp/purchase-in/transfer-outable-items',
    );
    expect(purchaseInApiSource).toContain(
      '/erp/purchase-in/transfer-outable-item-page',
    );
    expect(purchaseInApiSource).toContain(
      'function getPurchaseInTransferOutableItemPage',
    );
  });

  it('uses a paged selectable modal for purchase order inable items', () => {
    expect(purchaseOrderInableModalSource).toContain(
      'const DEFAULT_PAGE_SIZE = 20;',
    );
    expect(purchaseOrderInableModalSource).toContain(
      'PRODUCT_KEYWORD_PLACEHOLDER',
    );
    expect(purchaseOrderInableModalSource).toContain('getInableItemPage({');
    expect(purchaseOrderInableModalSource).toContain(
      'productKeyword: productKeyword.value.trim() || undefined',
    );
    expect(purchaseOrderInableModalSource).toContain('selectedMap');
    expect(purchaseOrderInableModalSource).toContain('rowCache');
    expect(purchaseOrderInableModalSource).toContain(
      'return String(record.orderItemId);',
    );
    expect(purchaseOrderInableModalSource).toContain(
      'preserveSelectedRowKeys: true',
    );
    expect(purchaseOrderInableModalSource).not.toContain(
      'getInableItemsByOrderId',
    );
  });

  it('shows realtime stock and refreshes it when the inbound warehouse changes', () => {
    expect(purchaseOrderApiSource).toContain(
      '/erp/purchase-order/inable-item-stock-query',
    );
    expect(purchaseOrderApiSource).toContain('function getInableItemStockList');
    expect(purchaseOrderInableModalSource).toContain("title: '库存'");
    expect(purchaseOrderInableModalSource).toContain("title: '可用库存'");
    expect(purchaseOrderInableModalSource).toContain(
      'refreshStockForRows([record])',
    );
    expect(purchaseOrderInableModalSource).toContain('stockRequestTokenMap');
    expect(purchaseOrderInableModalSource).toContain('stockWarehouseId');
    expect(purchaseOrderInableModalSource).not.toContain(
      'record.inQty > record.availableCount',
    );
  });

  it('routes purchase order partial inbound through the paged modal', () => {
    expect(purchaseOrderInModalSource).toContain(
      'PurchaseOrderInableItemSelectModal',
    );
    expect(purchaseOrderInModalSource).toContain('createPurchaseInFromOrder');
    expect(purchaseOrderInModalSource).toContain(
      'selectModalRef.value?.open(id)',
    );
    expect(purchaseOrderInModalSource).not.toContain('getInableItemsByOrderId');
  });

  it('opens paged inable item selection after choosing a source purchase order', () => {
    expect(purchaseInFormSource).toContain(
      'getPurchaseOrder(order.id, { includeItems: false, mask: false })',
    );
    expect(purchaseInFormSource).toContain(
      'orderInableItemSelectRef.value?.open(sourceOrder.id)',
    );
    expect(purchaseInFormSource).toContain('handleSelectOrderInableItems');
    expect(purchaseInFormSource).toContain(
      'PurchaseOrderInableItemSelectModal',
    );
  });

  it('uses paged transfer-outable items with cross-page caches', () => {
    expect(transferOutFormSource).toContain(
      'getPurchaseInTransferOutableItemPage',
    );
    expect(transferOutFormSource).toContain('const DEFAULT_PAGE_SIZE = 20;');
    expect(transferOutFormSource).toContain(
      'productKeyword: productKeyword.value.trim() || undefined',
    );
    expect(transferOutFormSource).toContain('selectedMap');
    expect(transferOutFormSource).toContain('deselectedRowKeys');
    expect(transferOutFormSource).toContain('rowCache');
    expect(transferOutFormSource).toContain(
      'return String(record.sourceInItemId);',
    );
    expect(transferOutFormSource).toContain(
      'getPurchaseIn(sourceId, { includeItems: false })',
    );
    expect(transferOutFormSource).not.toContain(
      'getPurchaseInTransferOutableItems',
    );
  });

  it('formats the editable transfer quantity without meaningless trailing zeros', () => {
    expect(transferOutFormSource).toContain(
      "import { formatPurchaseInCountInput } from './purchase-in-count-input';",
    );
    expect(transferOutFormSource).toContain(
      ':formatter="formatPurchaseInCountInput"',
    );
    expect(transferOutFormSource).toContain(':precision="3"');
    expect(transferOutFormSource).toContain(
      ':max="record.transferOutableCount"',
    );
  });
});
