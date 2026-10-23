import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const routerSource = readFileSync(join(currentDir, 'index.ts'), 'utf8');
const productionEnv = readFileSync(
  join(currentDir, '../../.env.production'),
  'utf8',
);

describe('production router history mode', () => {
  it('uses browser history routes in the production build', () => {
    expect(productionEnv).toContain('VITE_ROUTER_HISTORY=history');
    expect(routerSource).toContain(
      'createWebHistory(import.meta.env.VITE_BASE)',
    );
  });

  it('migrates legacy hash route links without affecting ordinary anchors', () => {
    expect(routerSource).toContain("hash.startsWith('#/')");
    expect(routerSource).toContain('window.history.replaceState(');
    expect(routerSource).toContain('`${base}${hash.slice(1)}`');
  });
});
