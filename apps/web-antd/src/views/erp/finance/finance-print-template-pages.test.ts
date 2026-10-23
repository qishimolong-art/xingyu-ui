import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const financeDir = dirname(fileURLToPath(import.meta.url));

const pages = [
  {
    file: 'settlement/payment/index.vue',
    moduleKey: 'finance_payment',
    printPermission: 'erp:finance-payment:print',
    templatePermission: 'erp:finance-payment:print-template',
  },
  {
    file: 'settlement/receipt/index.vue',
    moduleKey: 'finance_receipt',
    printPermission: 'erp:finance-receipt:print',
    templatePermission: 'erp:finance-receipt:print-template',
  },
  {
    file: 'cash-bank/transfer/index.vue',
    moduleKey: 'finance_transfer',
    printPermission: 'erp:finance-transfer:print',
    templatePermission: 'erp:finance-transfer:print-template',
  },
];

describe('finance print template pages', () => {
  it.each(pages)(
    'wires multi-template print entry for $moduleKey',
    ({ file, moduleKey, printPermission, templatePermission }) => {
      const source = readFileSync(join(financeDir, file), 'utf8');

      expect(source).toContain('import PrintTemplateModal');
      expect(source).toContain('import PrintTemplateSelector');
      expect(source).toContain('useErpPrintTemplate');
      expect(source).toContain(`const PRINT_TEMPLATE_MODULE = '${moduleKey}'`);
      expect(source).toContain('PrintTemplateDesignModal');
      expect(source).toContain('PrintTemplateSelector');
      expect(source).toContain('handleOpenPrintTemplateDesigner');
      expect(source).toContain('handlePrint');
      expect(source).toContain(printPermission);
      expect(source).toContain(templatePermission);
      expect(source).toContain('@printed="handleRefresh"');
      expect(source).not.toContain('打印模板配置中');
    },
  );
});
