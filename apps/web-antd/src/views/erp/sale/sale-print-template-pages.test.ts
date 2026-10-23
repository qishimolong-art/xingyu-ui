import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useFormItemColumns as useSaleCartFormItemColumns } from './cart/data';
import {
  useFormItemColumns as useSaleOrderFormItemColumns,
  useGridColumns as useSaleOrderGridColumns,
} from './order/data';
import { useDetailItemColumns as useSaleOutDetailItemColumns } from './out/data';
import { useFormItemColumns as useSalePriceAdjustFormItemColumns } from './priceadjust/data';
import { useFormItemColumns as useSaleQuoteFormItemColumns } from './quote/data';
import { useFormItemColumns as useSaleReturnFormItemColumns } from './return/data';

const saleDir = dirname(fileURLToPath(import.meta.url));

const pages = [
  {
    file: 'order/index.vue',
    moduleKey: 'sale_order',
    printPermission: 'erp:sale-order:print',
    templatePermission: 'erp:sale-order:print-template',
  },
  {
    file: 'out/index.vue',
    moduleKey: 'sale_out',
    printPermission: 'erp:sale-out:print',
    templatePermission: 'erp:sale-out:print-template',
  },
  {
    file: 'return/index.vue',
    moduleKey: 'sale_return',
    printPermission: 'erp:sale-return:print',
    templatePermission: 'erp:sale-return:print-template',
  },
  {
    file: 'quote/index.vue',
    moduleKey: 'sale_quote',
    printPermission: 'erp:sale-quote:print',
    templatePermission: 'erp:sale-quote:print-template',
  },
  {
    file: 'priceadjust/index.vue',
    moduleKey: 'sale_price_adjust',
    printPermission: 'erp:sale-price-adjust:print',
    templatePermission: 'erp:sale-price-adjust:print-template',
  },
  {
    file: 'cart/index.vue',
    moduleKey: 'sale_cart',
    printPermission: 'erp:sale-cart:print',
    templatePermission: 'erp:sale-cart:print-template',
  },
];

function columnFields(
  columns: NonNullable<ReturnType<typeof useSaleOrderGridColumns>>,
) {
  return columns
    .filter((column) => !('children' in column))
    .map((column) => column.field ?? column.type);
}

describe('sale print template pages', () => {
  it.each(pages)(
    'wires multi-template print entry for $moduleKey',
    ({ file, moduleKey, printPermission, templatePermission }) => {
      const source = readFileSync(join(saleDir, file), 'utf8');

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
      expect(source).not.toContain('打印功能待接入');
      expect(source).not.toContain('打印模板正在配置中');
    },
  );

  it('adds the sale order row print column without adding print statistics columns', () => {
    const columns = useSaleOrderGridColumns() || [];
    const fields = columnFields(columns);

    expect(fields).toContain('printAction');
    expect(fields).not.toContain('printCount');
    expect(fields).not.toContain('printTime');
  });

  it('shows piece count after package quantity in sale item forms', () => {
    const itemColumnGroups = [
      useSaleOrderFormItemColumns(false) || [],
      useSaleOutDetailItemColumns() || [],
      useSaleReturnFormItemColumns([], false) || [],
      useSaleQuoteFormItemColumns(false) || [],
      useSalePriceAdjustFormItemColumns(false) || [],
      useSaleCartFormItemColumns(false) || [],
    ];

    itemColumnGroups.forEach((columns) => {
      const fields = columnFields(columns);
      expect(fields).toContain('packageQty');
      expect(fields).toContain('pieceCount');
      expect(fields.indexOf('pieceCount')).toBe(
        fields.indexOf('packageQty') + 1,
      );
    });
  });

  it('keeps sale cart on the shared multi-template print path', () => {
    const source = readFileSync(join(saleDir, 'cart/index.vue'), 'utf8');
    const formSource = readFileSync(
      join(saleDir, 'cart/modules/form.vue'),
      'utf8',
    );
    const modalSource = readFileSync(
      join(saleDir, '../components/PrintTemplateModal.vue'),
      'utf8',
    );
    const staticPrintSource = readFileSync(
      join(
        saleDir,
        '../../../../public/static/erp/purchase-print-template.html',
      ),
      'utf8',
    );

    expect(source).toContain("const PRINT_TEMPLATE_MODULE = 'sale_cart'");
    expect(source).toContain('v-access:code="[\'erp:sale-cart:print\']"');
    expect(source).toContain('selectTemplate: selectPrintTemplate');
    expect(source).toContain('@print="handleDetailPrint"');
    expect(source).toContain('itemOrderField: payload.itemOrderField');
    expect(source).toContain('itemOrderDirection: payload.itemOrderDirection');
    expect(formSource).toContain("hasAccessByCodes(['erp:sale-cart:print'])");
    expect(formSource).toContain(':title="detailPrintTitle"');
    expect(formSource).toContain("emit('print'");
    expect(formSource.indexOf('修改备注')).toBeLessThan(
      formSource.indexOf(':title="detailPrintTitle"'),
    );
    expect(formSource.indexOf(':title="detailPrintTitle"')).toBeLessThan(
      formSource.indexOf('复制'),
    );
    expect(modalSource).toContain("params.set('itemOrderField'");
    expect(modalSource).toContain("params.set('itemOrderDirection'");
    expect(staticPrintSource).toContain("urlParams.get('itemOrderField')");
    expect(staticPrintSource).toContain("params.set('itemOrderField'");
    expect(source).not.toContain('打印模板正在配置中');
  });

  it('forces sale-out cloud print through PDF preview and token confirmation', () => {
    const source = readFileSync(join(saleDir, 'out/index.vue'), 'utf8');
    const previewSource = readFileSync(
      join(saleDir, 'out/modules/CloudPrintPreviewModal.vue'),
      'utf8',
    );

    expect(source).toContain('selectTemplate: selectPrintTemplate');
    expect(source).toContain('templateId?: number | string');
    expect(source).toContain('cloudPrintPreviewRef.value?.open(');
    expect(source).toContain('itemOrderField');
    expect(source).toContain('itemOrderDirection');
    expect(source).toContain('CloudPrintPreviewModal');
    expect(source).toContain('return selectPrintTemplate(row');
    expect(previewSource).toContain('previewSaleOutCloudPrint');
    expect(previewSource).toContain('getSaleOutCloudPrintPreviewFile');
    expect(previewSource).toContain('submitSaleOutCloudPrint');
    expect(previewSource).toContain('previewToken: preview.value.previewToken');
    expect(previewSource).toContain('items.value.every');
    expect(previewSource).toContain('URL.revokeObjectURL');
    expect(previewSource).toContain('确认云打印');
  });

  it('passes current item sorting from all sale detail pages into printing', () => {
    for (const module of ['order', 'out', 'return', 'quote', 'priceadjust']) {
      const indexSource = readFileSync(
        join(saleDir, module, 'index.vue'),
        'utf8',
      );
      const formSource = readFileSync(
        join(saleDir, module, 'modules/form.vue'),
        'utf8',
      );
      expect(indexSource).toContain('@print="handleDetailPrint"');
      expect(indexSource).toContain('itemOrderField');
      expect(indexSource).toContain('itemOrderDirection');
      expect(formSource).toContain("emit('print'");
      expect(formSource).toContain('getItemPrintSortTitle');
    }
  });
});
