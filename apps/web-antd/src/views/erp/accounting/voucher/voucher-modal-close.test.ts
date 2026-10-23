import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');

describe('voucher modal close behavior', () => {
  it('uses the standard Vben modal close path instead of forcing isOpen via setState', () => {
    // 必须走标准关闭路径
    expect(formSource).toContain('modalApi.close()');
    // 不再使用自定义 forceClose hack
    expect(formSource).not.toContain('forceClose');
    // 不再绕过生命周期直接改 state
    expect(formSource).not.toMatch(/setState\(\{[\s\S]*?isOpen:\s*false/);
    // 不再禁用 Vben 默认的 header/footer/closable
    expect(formSource).not.toContain('closable: false');
    expect(formSource).not.toContain('footer: false');
    expect(formSource).not.toContain('header: false');
    // 所有关闭场景统一在 onOpenChange(false) emit close
    expect(formSource).toContain("emit('close')");
  });

  it('prevents the closing click from reopening the row detail modal', () => {
    expect(indexSource).toContain('ignoreRowClickUntil');
    expect(indexSource).toContain('handleFormModalOpenChange');
    expect(indexSource).toContain('Date.now() < ignoreRowClickUntil');
    expect(indexSource).not.toContain('formModalKey');
    expect(indexSource).toContain('@close="handleFormModalClose"');
  });
});
