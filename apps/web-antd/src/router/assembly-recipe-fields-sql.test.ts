import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(currentDir, '../../../../../code/sql/mysql');
const migration = readFileSync(
  join(sqlDir, 'erp_assembly_recipe_fields_v289.sql'),
  'utf8',
);
const precheck = readFileSync(
  join(sqlDir, 'erp_assembly_recipe_fields_v289_precheck.sql'),
  'utf8',
);

describe('assembly recipe fields v289 sql', () => {
  it('adds module identity, labor cost and order snapshots idempotently', () => {
    expect(migration).toContain("'module_code'");
    expect(migration).toContain("'module_name'");
    expect(migration).toContain("'labor_cost_per_set'");
    expect(migration).toContain("'recipe_module_code'");
    expect(migration).toContain("'material_cost'");
    expect(migration).toContain("'labor_cost'");
    expect(migration).toContain('uk_erp_assembly_recipe_active_module_code');
    expect(migration).toContain('information_schema.columns');
    expect(migration).toContain('information_schema.statistics');
  });

  it('backfills from the bound product without touching permissions or menus', () => {
    expect(migration).toContain('JOIN erp_product p');
    expect(migration).toContain('THEN TRIM(p.code)');
    expect(migration).toContain('THEN TRIM(p.name)');
    expect(migration).toContain('THEN COALESCE(o.total_cost, 0.000000)');
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
    expect(migration).not.toMatch(/TRUNCATE|DROP\s+TABLE/i);
    expect(migration).not.toContain('system_menu');
    expect(migration).not.toContain('system_role_menu');
  });

  it('keeps the precheck read only and reports conflicting product identities', () => {
    expect(precheck).toContain('active_recipe_missing_product_identity');
    expect(precheck).toContain('proposed_module_code');
    expect(precheck).not.toMatch(/\bUPDATE\b|\bINSERT\b|\bDELETE\b|\bALTER\b/i);
  });
});
