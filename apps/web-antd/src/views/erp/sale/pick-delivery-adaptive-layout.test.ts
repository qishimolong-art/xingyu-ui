import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

describe.each(['pick', 'delivery'])('%s workbench adaptive layout', (dir) => {
  const source = readFileSync(join(currentDir, dir, 'index.vue'), 'utf8');

  it('fits current-page list columns to the real desktop container', () => {
    expect(source).toContain('prepareSaleDocumentListColumns(');
    expect(source).toContain('applySaleDocumentListColumnCustomization(');
    expect(source).toContain('fitPickDeliveryTableColumns(');
    expect(source).toContain('ref="desktopGridShellRef"');
    expect(source).toContain('new ResizeObserver(queueAdaptiveTableWidths)');
    expect(source).toContain('fit: false');
  });

  it('fits detail tables on wide screens and keeps computed horizontal overflow', () => {
    expect(source).toContain('width="min(2200px, calc(100vw - 48px))"');
    expect(source).toContain('ref="detailTableWrapRef"');
    expect(source).toContain(':columns="adaptiveItemColumns"');
    expect(source).toContain(':columns="adaptiveSubmitColumns"');
    expect(source).toContain(':scroll="{ x: detailItemScrollX }"');
    expect(source).toContain(':scroll="{ x: detailSubmitScrollX }"');
  });

  it('does not add unrelated table tools or business shortcuts', () => {
    expect(source).toContain('toolbarConfig: { refresh: true, search: true }');
    expect(source).not.toContain('toolbarConfig: { custom: true');
    expect(source).not.toContain("event.key === 'Insert'");
  });
});
