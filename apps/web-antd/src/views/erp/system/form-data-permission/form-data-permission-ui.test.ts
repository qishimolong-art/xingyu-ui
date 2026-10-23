import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const apiSource = readFileSync(
  join(
    currentDir,
    '..',
    '..',
    '..',
    '..',
    'api',
    'system',
    'form-data-permission',
    'index.ts',
  ),
  'utf8',
);

describe('ERP form data permission UI', () => {
  it('explains that form rules are extra visible union conditions', () => {
    expect(pageSource).toContain('表单数据权限是额外可见条件');
    expect(pageSource).toContain('与角色/部门的数据范围取并集');
    expect(pageSource).toContain('不会缩小原有');
    expect(pageSource).toContain('字段值命中当前用户时额外可见');
  });

  it('keeps frontend value types aligned with backend form permission parsing', () => {
    expect(apiSource).toContain("'single_id'");
    expect(apiSource).toContain("'csv_ids'");
    expect(apiSource).toContain("'json_ids'");
    expect(pageSource).toContain('额外可见：字段等于本人');
    expect(pageSource).toContain('额外可见：CSV 包含本人');
    expect(pageSource).toContain('额外可见：JSON 包含本人');
    expect(pageSource).toContain('valueType: column.valueType');
    expect(pageSource).not.toContain("valueType: 'single_id',");
  });
});
