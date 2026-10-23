import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const itemSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');

function functionsFrom(source: string, names: string[]) {
  const script = source.slice(
    source.indexOf('>') + 1,
    source.indexOf('</script>'),
  );
  const ast = ts.createSourceFile(
    'form.ts',
    script,
    ts.ScriptTarget.Latest,
    true,
  );
  return ast.statements
    .filter(
      (node) =>
        ts.isFunctionDeclaration(node) && names.includes(node.name!.text),
    )
    .map((node) => node.getText(ast))
    .join('\n');
}

// Exercise the real emit -> submit normalization -> item validation boundary.
// Rendering VXE is unnecessary for this serialization regression.
function createValidation() {
  const context = {
    buildPurchaseItemDuplicateKey: () => undefined,
    emitItemsUpdate: vi.fn(),
    erpCountInputFormatter: String,
    erpPriceInputFormatter: (value: number) => Number(value).toFixed(2),
    erpPriceMultiply: (price: number, count: number) => price * count,
    formatPurchaseDecimal: (value: unknown, fallback = '') =>
      value === null || value === undefined || value === ''
        ? fallback
        : String(Number(value)),
    purchaseDecimalMultiply: (price: number, count: number) => price * count,
    isBatchNoEnabled: () => false,
    stripPurchaseItemClientFields: (item: Record<string, unknown>) => item,
    result: {} as {
      normalize: (items: any[]) => any[];
      sanitize: (item: any) => any;
      validate: (items: any[]) => void;
    },
  };
  const source = [
    functionsFrom(itemSource, [
      'sanitizeItemForEmit',
      'parseCountText',
      'parseBusinessNumberText',
      'setCountText',
      'setBusinessNumberTexts',
      'initRow',
      'validate',
    ]),
    functionsFrom(formSource, ['normalizePurchaseInSubmitItems']),
    'result = { normalize: normalizePurchaseInSubmitItems, sanitize: sanitizeItemForEmit, validate };',
  ].join('\n');
  new Script(ts.transpileModule(source, {}).outputText).runInNewContext(
    context,
  );
  return context.result;
}

function validRow(overrides: Record<string, unknown> = {}) {
  return {
    count: 1,
    countText: '1',
    gift: false,
    priceText: '19.55',
    productId: 100,
    productPrice: 19.55,
    taxPercent: 13,
    taxPercentText: '13',
    warehouseId: 1,
    wholeQty: 2,
    wholeQtyText: '2',
    ...overrides,
  };
}

describe('purchase in submission numeric validation', () => {
  it.each(['create', 'update', 'insert'])(
    'validates emitted %s rows without losing price, whole quantity or tax',
    (operation) => {
      const { normalize, sanitize, validate } = createValidation();
      const emitted = sanitize(validRow({ operation }));
      expect(emitted).not.toHaveProperty('priceText');
      const rows = normalize([emitted]);
      expect(() => validate(rows)).not.toThrow();
      expect(rows[0]).toMatchObject({
        count: 1,
        operation,
        productPrice: 19.55,
        taxPercent: 13,
        wholeQty: 2,
      });
    },
  );

  it.each([
    [undefined, '请输入入库单价'],
    [0, '入库单价不能小于'],
    [-1, '入库单价必须为数字'],
    [1.2345678, '最多 6 位小数'],
  ] as const)(
    'rejects invalid serialized price %s',
    (productPrice, expected) => {
      const { normalize, sanitize, validate } = createValidation();
      const rows = normalize([sanitize(validRow({ productPrice }))]);
      expect(() => validate(rows)).toThrow(expected);
    },
  );

  it('keeps explicitly cleared or invalid live input invalid instead of using the old price', () => {
    const { validate } = createValidation();
    expect(() => validate([validRow({ priceText: '' })])).toThrow(
      '请输入入库单价',
    );
    expect(() => validate([validRow({ priceText: 'abc' })])).toThrow(
      '必须为数字',
    );
  });

  it('uses the live price before blur when present', () => {
    const { validate } = createValidation();
    const row = validRow({ priceText: '22.30' });
    validate([row]);
    expect(row.productPrice).toBe(22.3);
  });

  it('allows zero-price gifts and absent optional fields', () => {
    const { normalize, sanitize, validate } = createValidation();
    const rows = normalize([
      sanitize(
        validRow({
          gift: true,
          productPrice: 0,
          wholeQty: undefined,
          taxPercent: undefined,
        }),
      ),
    ]);
    expect(() => validate(rows)).not.toThrow();
    expect(rows[0].productPrice).toBe(0);
    expect(rows[0].wholeQty).toBeUndefined();
    expect(rows[0].taxPercent).toBeUndefined();
  });

  it.each([
    [{ wholeQty: 1.5 }, '整件数必须为整数'],
    [{ taxPercent: 101 }, '税率不能大于'],
  ] as const)(
    'still validates serialized optional fields: %s',
    (overrides, expected) => {
      const { normalize, sanitize, validate } = createValidation();
      expect(() =>
        validate(normalize([sanitize(validRow(overrides))])),
      ).toThrow(expected);
    },
  );
});
