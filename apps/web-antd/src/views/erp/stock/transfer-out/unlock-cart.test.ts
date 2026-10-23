import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const transferOutApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/stock/transfer-out/index.ts'),
  'utf8',
);
const stockMoveApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/stock/move/index.ts'),
  'utf8',
);

describe('transfer-out unlock cart entry', () => {
  it('keeps the unlock entry in the detail footer only', () => {
    const rowActions = indexSource.match(
      /<template #actions[\s\S]*?<\/template>/,
    )?.[0];
    const toolbarActions = indexSource.match(
      /<template #toolbar-tools[\s\S]*?<\/template>/,
    )?.[0];

    expect(formSource).toContain(
      '<template v-if="!reportViewOnly" #prepend-footer>',
    );
    expect(formSource).toContain('解锁手推车');
    expect(rowActions).not.toContain('unlockSaleCart');
    expect(rowActions).not.toContain('erp:stock-transfer-out:unlock-cart');
    expect(toolbarActions).not.toContain('unlockSaleCart');
    expect(toolbarActions).not.toContain('erp:stock-transfer-out:unlock-cart');
  });

  it('checks detail state, source, backend qualification and permission', () => {
    expect(formSource).toContain("formType.value === 'detail'");
    expect(formSource).toContain('formData.value?.transferDirection !== 20');
    expect(formSource).toContain('formData.value?.sourceType === 30');
    expect(formSource).toContain('formData.value?.status === 10');
    expect(formSource).toContain('formData.value?.unlockCartAllowed !== false');
    expect(formSource).toContain('erp:stock-transfer-out:unlock-cart');
    expect(formSource).toContain(':disabled="!!unlockCartDisabledReason"');
  });

  it('confirms all side effects before calling the dedicated endpoint', () => {
    expect(formSource).toMatch(/确认解锁来源手推车【\$\{sourceNo\}】吗？/);
    expect(formSource).toContain('删除当前未审核调拨出库单、释放库存占用');
    expect(formSource).toContain('将手推车退回待初审状态');
    expect(formSource).toMatch(
      /AntdModal\.confirm\([\s\S]*?async onOk\(\)[\s\S]*?await unlockSaleCart\(transferOutId\)/,
    );
    expect(transferOutApiSource).toContain(
      "requestClient.put('/erp/stock-transfer-out/unlock-cart'",
    );
  });

  it('closes, refreshes and clears selected rows after a successful unlock', () => {
    expect(formSource).toContain("type: 'unlock-cart'");
    expect(formSource).toContain('await modalApi.close()');
    expect(indexSource).toContain("event?.type === 'unlock-cart'");
    expect(indexSource).toContain('clearCheckboxRow');
    expect(indexSource).toContain('clearCheckboxReserve');
    expect(indexSource).toContain('@success="handleFormSuccess"');
  });

  it('protects cart-source records from ordinary single and batch deletion', () => {
    expect(indexSource).toContain('if (row.sourceType === 30)');
    expect(indexSource).toContain(
      '销售手推车来源调拨出库单请使用详情中的“解锁手推车”操作',
    );
    expect(indexSource).toContain('rows.filter((row) => isDeleteAllowed(row))');
    expect(indexSource).toContain('rows.length - targetRows.length');
    expect(indexSource).toContain('ifShow: () => isDeleteAllowed(row)');
  });

  it('declares the backend qualification fields on the detail type', () => {
    expect(stockMoveApiSource).toContain('unlockCartAllowed?: boolean;');
    expect(stockMoveApiSource).toContain('unlockCartDisabledReason?: string;');
  });
});
