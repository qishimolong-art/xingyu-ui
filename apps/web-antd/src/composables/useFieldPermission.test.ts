import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { isFieldHidden } from './useFieldPermission';

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, 'useFieldPermission.ts'), 'utf8');

describe('useFieldPermission cache contract', () => {
  it('keeps product price permissions isolated by business department', () => {
    expect(source).toContain('businessDeptId?: BusinessDeptId');
    expect(source).toContain('getCacheKey(');
    expect(source).toContain('businessDeptId=');
    expect(source).toContain('normalizeBusinessDeptId(businessDeptId)');
  });

  it('keeps normal field permissions separate from product price view permissions', () => {
    expect(source).toContain(
      'includeProductPricePermission?: IncludeProductPricePermission',
    );
    expect(source).toContain('productPricePermission=false');
    expect(source).toContain('includeProductPricePermission) ?? true');
  });

  it('keeps sale price permissions isolated by customer price level', () => {
    expect(source).toContain('customerPriceLevel?: CustomerPriceLevel');
    expect(source).toContain('customerPriceLevel=');
    expect(source).toContain('unref(options.customerPriceLevel)');
  });

  it('clears every department-specific cache entry for the module', () => {
    expect(source).toContain('key === module || key.startsWith(`${module}::`)');
  });

  it('matches legacy product price field aliases', () => {
    expect(isFieldHidden(['branch_price'], 'referencePrice')).toBe(true);
    expect(isFieldHidden(['col_backup_price1'], 'backupPrice1')).toBe(true);
    expect(isFieldHidden(['lastPurchasePrice'], 'last_purchase_price')).toBe(
      true,
    );
  });
});
