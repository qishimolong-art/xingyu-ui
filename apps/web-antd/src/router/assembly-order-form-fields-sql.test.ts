import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(currentDir, '../../../../../code/sql/mysql');
const migration = readFileSync(
  join(sqlDir, 'erp_assembly_order_form_fields_v291.sql'),
  'utf8',
);
const precheck = readFileSync(
  join(sqlDir, 'erp_assembly_order_form_fields_v291_precheck.sql'),
  'utf8',
);

describe('assembly order form fields v291 sql', () => {
  it('adds customer, handler, split warehouse, shelf and other cost idempotently', () => {
    expect(migration).toContain("'customer_id'");
    expect(migration).toContain("'handler_id'");
    expect(migration).toContain("'out_warehouse_id'");
    expect(migration).toContain("'shelf'");
    expect(migration).toContain("'other_cost'");
    expect(migration).toContain('information_schema.columns');
    expect(migration).toContain('information_schema.statistics');
  });

  it('preserves historical warehouse semantics and avoids destructive data SQL', () => {
    expect(migration).toContain('SET out_warehouse_id = warehouse_id');
    expect(migration).not.toMatch(/DELETE\s+FROM|TRUNCATE|DROP\s+TABLE/i);
    expect(migration).not.toContain('system_menu');
    expect(migration).not.toContain('system_role_menu');
  });

  it('keeps the precheck read only', () => {
    expect(precheck).toContain('active_order_missing_in_warehouse');
    expect(precheck).not.toMatch(/\bUPDATE\b|\bINSERT\b|\bDELETE\b|\bALTER\b/i);
  });
});
