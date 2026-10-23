import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const adapterSource = readFileSync(join(currentDir, 'vxe-table.ts'), 'utf8');

describe('VXE table popup layering', () => {
  it('keeps teleported column-setting confirmations above Vben dialogs', () => {
    expect(adapterSource).toMatch(
      /vxeUI\.setConfig\(\{\s*[\s\S]*?zIndex:\s*2100,/,
    );
  });
});
