import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(currentDir, '../../../..');

function readSource(path: string) {
  return readFileSync(resolve(root, path), 'utf-8');
}

describe('erp attachment scan ui contract', () => {
  it('keeps the hidden mobile route anonymous', () => {
    const coreRoutes = readSource('src/router/routes/core.ts');

    expect(coreRoutes).toContain("path: '/erp/attachment-scan/mobile'");
    expect(coreRoutes).toContain("name: 'ErpAttachmentScanMobile'");
    expect(coreRoutes).toContain('ignoreAccess: true');
    expect(coreRoutes).toContain('hideInMenu: true');
  });

  it('loads the pc demo route from backend menus instead of a hidden static route', () => {
    const demoRoute = readSource(
      'src/router/routes/modules/erp-attachment-scan.ts',
    );
    const demo = readSource('src/views/erp/attachment-scan/demo.vue');

    expect(demoRoute).toContain('const routes: RouteRecordRaw[] = []');
    expect(demoRoute).not.toContain("path: '/erp/attachment-scan/demo'");
    expect(demoRoute).not.toContain('ignoreAccess: true');
    expect(demo).toContain("defineOptions({ name: 'ErpAttachmentScanDemo' })");
  });

  it('uses the dedicated backend api paths', () => {
    const api = readSource('src/api/erp/attachment-scan/index.ts');

    expect(api).toContain('/erp/attachment-scan/create');
    expect(api).toContain('/erp/attachment-scan/session');
    expect(api).toContain('/erp/attachment-scan/upload');
    expect(api).toContain('/erp/attachment-scan/status');
    expect(api).toContain('/erp/attachment-scan/cancel');
    expect(api).toContain('X-Erp-Router-Mode');
    expect(api).toContain('VITE_ROUTER_HISTORY');
  });

  it('keeps the pc demo qr and polling behavior', () => {
    const demo = readSource('src/views/erp/attachment-scan/demo.vue');

    expect(demo).toContain('QRCode');
    expect(demo).toContain(':value="session.qrUrl"');
    expect(demo).toContain('setInterval(refreshStatus, 2000)');
    expect(demo).toContain('cancelAttachmentScan');
  });

  it('keeps the mobile ticket upload behavior without login dependencies', () => {
    const mobile = readSource('src/views/erp/attachment-scan/mobile.vue');

    expect(mobile).toContain('syncTenantFromQuery');
    expect(mobile).toContain('accessStore.setTenantId(tenantId)');
    expect(mobile).toContain('route.query.ticket');
    expect(mobile).toContain('accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"');
    expect(mobile).toContain('capture="environment"');
    expect(mobile).toContain('uploadAttachmentScanFile(ticket.value, file');
  });
});
