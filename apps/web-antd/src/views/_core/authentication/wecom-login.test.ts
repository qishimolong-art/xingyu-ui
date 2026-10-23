import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, 'wecom-login.vue'), 'utf8');
const workbenchBridgeSource = readFileSync(
  join(currentDir, '../../../../public/wecom-login.html'),
  'utf8',
);

describe('WeCom login tenant contract', () => {
  it('sets a default tenant before requesting the WeCom authorize URL', () => {
    expect(source).toContain("import { isTenantEnable } from '@vben/hooks'");
    expect(source).toContain('const DEFAULT_TENANT_ID = 1');
    expect(source).toContain(
      "parseTenantId(getQueryString('tenantId')) || DEFAULT_TENANT_ID",
    );
    expect(source).toContain('accessStore.setTenantId(tenantId)');
    expect(source).toContain('weComAuthRedirect(');
    expect(source).toContain('buildRedirectUri(tenantId)');
  });

  it('keeps the resolved tenant on callback and fallback login routes', () => {
    expect(source).toContain("params.set('tenantId', String(tenantId))");
    expect(source).toContain('await fallbackToLogin(tenantId)');
    expect(source).toContain('query.tenantId = String(tenantId)');
    expect(source).toContain("key === 'code' || key === 'state'");
  });

  it('supports fixed workbench entries for sale pick and delivery pages', () => {
    expect(source).toContain('const WECOM_WORKBENCH_REDIRECTS');
    expect(source).toContain(
      "'sale-pick': '/wecom/sale-pick?wecomWorkbench=1'",
    );
    expect(source).toContain(
      "'sale-delivery': '/wecom/sale-delivery?wecomWorkbench=1'",
    );
    expect(source).toContain('const WECOM_WORKBENCH_CLIENT_KEYS');
    expect(source).toContain("'sale-pick': 'sale-pick'");
    expect(source).toContain("'sale-delivery': 'sale-delivery'");
    expect(source).toContain('getWorkbenchClientKey()');
    expect(source).toContain('getWorkbenchRedirectPath() || getQueryString');
    expect(source).toContain('decodeRedirectPath(getRedirectPath())');
    expect(source).toContain('/wecom-login.html');
  });

  it('preserves the pick task id when redirecting into the pick workbench', () => {
    expect(source).toContain("workbench !== 'sale-pick'");
    expect(source).toContain("const taskId = getQueryString('taskId')");
    expect(source).toContain('encodeURIComponent(taskId)');
  });

  it('keeps workbench query params when using the static WeCom bridge page', () => {
    expect(workbenchBridgeSource).toContain(
      "new URL('/auth/wecom-login', window.location.origin)",
    );
    expect(workbenchBridgeSource).toContain(
      'new URLSearchParams(window.location.search)',
    );
    expect(workbenchBridgeSource).toContain("hash.indexOf('#?') === 0");
    expect(workbenchBridgeSource).toContain("hash.indexOf('?') >= 0");
    expect(workbenchBridgeSource).toContain(
      "target.hash + (query ? '?' + query",
    );
    expect(workbenchBridgeSource).toContain('window.location.replace');
  });
});
