import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

const listPages = [
  {
    dir: 'in',
    deptApi: 'getStockInDeptSimplePage',
    userApi: 'getStockInUserSimplePage',
    pageApi: 'getStockInPage',
  },
  {
    dir: 'out',
    deptApi: 'getStockOutDeptSimplePage',
    userApi: 'getStockOutUserSimplePage',
    pageApi: 'getStockOutPage',
  },
  {
    dir: 'check',
    deptApi: 'getStockCheckDeptSimplePage',
    userApi: 'getStockCheckUserSimplePage',
    pageApi: 'getStockCheckPage',
  },
  {
    dir: 'move',
    deptApi: 'getStockMoveDeptSimplePage',
    userApi: 'getStockMoveUserSimplePage',
    pageApi: 'getStockMovePage',
  },
  {
    dir: 'warehouse-move',
    deptApi: 'getWarehouseMoveDeptSimplePage',
    userApi: 'getWarehouseMoveUserSimplePage',
    pageApi: 'getWarehouseMovePage',
  },
  {
    dir: 'transfer-out',
    deptApi: 'getStockTransferOutFromDeptSimplePage',
    userApi: 'getStockTransferOutUserSimplePage',
    pageApi: 'getStockTransferOutPage',
  },
  {
    dir: 'transfer-in',
    deptApi: 'getStockTransferInFromDeptSimplePage',
    userApi: 'getStockTransferInUserSimplePage',
    pageApi: 'getStockTransferInPage',
  },
];

const reportPages = [
  {
    dir: 'inbill',
    lazyApis: ['getWarehouseSimplePage', 'getStockInBillUserSimplePage'],
  },
  {
    dir: 'outbill',
    lazyApis: ['getWarehouseSimplePage', 'getStockOutBillUserSimplePage'],
  },
  { dir: 'record', lazyApis: ['getWarehouseSimplePage'] },
  {
    dir: 'stock',
    lazyApis: [
      'getStockWarehouseFilterOptionPage',
      'getStockWarehouseOwnerDeptSimplePage',
    ],
  },
  {
    dir: 'transfer-ledger',
    lazyApis: [
      'getStockTransferLedgerFromDeptSimplePage',
      'getStockTransferLedgerToDeptSimplePage',
      'getWarehouseSimplePage',
    ],
  },
];

function readStockPageSource(dir: string, file: 'data.ts' | 'index.vue') {
  return readFileSync(join(currentDir, dir, file), 'utf8');
}

describe('stock document list performance contract', () => {
  it('uses product keyword input instead of full product selector on target lists', () => {
    listPages.forEach(({ dir }) => {
      const dataSource = readStockPageSource(dir, 'data.ts');

      expect(dataSource).toContain("fieldName: 'productKeyword'");
      expect(dataSource).toContain("component: 'Input'");
      expect(dataSource).toContain(
        '请输入配件编码、名称、单位等，多个条件可用 / 或空格分隔',
      );
      expect(dataSource).not.toMatch(
        /fieldName: 'productId',[\s\S]*?label: '产品',[\s\S]*?component: 'ApiSelect'/,
      );
    });
  });

  it('uses lazy filters and product keywords on stock report and task pages', () => {
    reportPages.forEach(({ dir, lazyApis }) => {
      const dataSource = readStockPageSource(dir, 'data.ts');

      expect(dataSource).toContain("fieldName: 'productKeyword'");
      expect(dataSource).toContain(
        dir === 'stock'
          ? '请输入配件编码、名称、单位等，多个条件可用 / 或空格分隔'
          : '请输入配件编码、名称、拼音码、五笔码等',
      );
      expect(dataSource).toContain("component: 'ErpLazyPageSelect'");
      expect(dataSource).toContain('pageSize: 10');
      lazyApis.forEach((api) => expect(dataSource).toContain(api));
      expect(dataSource).not.toMatch(
        /fieldName: 'productId',[\s\S]*?label: '产品',[\s\S]*?component: 'ApiSelect'/,
      );
    });
  });

  it('does not preload all departments for the warehouse management search form', () => {
    const dataSource = readStockPageSource('warehouse', 'data.ts');
    const indexSource = readStockPageSource('warehouse', 'index.vue');

    expect(dataSource).toContain("fieldName: 'deptId'");
    expect(dataSource).toContain("component: 'ErpLazyPageSelect'");
    expect(dataSource).toContain('getWarehouseDeptSimplePage');
    expect(dataSource).toContain('pageSize: 10');
    expect(indexSource).not.toContain('getWarehouseDeptSimpleList');
    expect(indexSource).toContain(
      'schema: withErpKeywordSearchSchema(useGridFormSchema())',
    );
  });

  it('lazy-loads database backed list filters by page', () => {
    listPages.forEach(({ deptApi, dir, userApi }) => {
      const dataSource = readStockPageSource(dir, 'data.ts');

      expect(dataSource).toContain("component: 'ErpLazyPageSelect'");
      expect(dataSource).toContain('pageSize: 10');
      expect(dataSource).toContain(deptApi);
      expect(dataSource).toContain(userApi);
      expect(dataSource).toContain('getWarehouseSimplePage');
    });
  });

  it('passes includeItems=false for normal and activation refresh list queries', () => {
    listPages.forEach(({ dir, pageApi }) => {
      const indexSource = readStockPageSource(dir, 'index.vue');

      expect(indexSource).toMatch(new RegExp(`${pageApi}\\((?:params|\\{)`));
      expect(indexSource.match(/includeItems: false/g)).toHaveLength(2);
    });
  });
});
