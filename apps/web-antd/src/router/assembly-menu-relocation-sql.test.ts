import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDir, '../../../../../');
const sqlSource = readFileSync(
  join(workspaceRoot, 'code/sql/mysql/erp_assembly_menu_relocation_v288.sql'),
  'utf8',
);

describe('assembly menu relocation SQL', () => {
  it('places both assembly pages under 基础数据 / 组装件', () => {
    expect(sqlSource).toContain('SET @assembly_base_parent_id := 6400');
    expect(sqlSource).toContain('SET @assembly_group_menu_id := 900697');
    expect(sqlSource).toContain("SELECT @assembly_group_menu_id, '组装件'");
    expect(sqlSource).toContain("path = 'assembly'");
    expect(sqlSource).toContain("component = 'erp/assembly/recipe/index'");
    expect(sqlSource).toContain("component = 'erp/assembly/order/index'");
    expect(sqlSource).toContain('parent_id = @assembly_group_menu_id');
  });

  it('keeps the existing page and button permission identities', () => {
    for (const permission of [
      'erp:assembly-recipe:query',
      'erp:assembly-recipe:create',
      'erp:assembly-recipe:update',
      'erp:assembly-recipe:delete',
      'erp:assembly-order:query',
      'erp:assembly-order:create',
      'erp:assembly-order:update',
      'erp:assembly-order:delete',
      'erp:assembly-order:complete',
      'erp:assembly-order:void',
    ]) {
      expect(sqlSource).toContain(permission);
    }
    expect(sqlSource).not.toMatch(/^\s*DELETE\s+/im);
    expect(sqlSource).not.toMatch(/^\s*TRUNCATE\s+/im);
    expect(sqlSource).not.toMatch(/^\s*DROP\s+/im);
  });

  it('backfills both parent grants without overwriting unrelated permissions', () => {
    expect(sqlSource).toContain('INSERT INTO system_role_menu');
    expect(sqlSource).toContain('NOT EXISTS (');
    expect(sqlSource).not.toContain('INSERT INTO system_tenant_package');
    expect(sqlSource).toContain('JSON_ARRAY_APPEND');
    expect(sqlSource).toContain('@assembly_base_parent_id');
    expect(sqlSource).toContain('@assembly_group_menu_id');
  });
});
