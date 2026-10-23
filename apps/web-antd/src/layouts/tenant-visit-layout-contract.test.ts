import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(
  resolve(process.cwd(), 'apps/web-antd/src/layouts/basic.vue'),
  'utf8',
);
const requestSource = readFileSync(
  resolve(process.cwd(), 'apps/web-antd/src/api/request.ts'),
  'utf8',
);
const tenantApiSource = readFileSync(
  resolve(process.cwd(), 'apps/web-antd/src/api/system/tenant/index.ts'),
  'utf8',
);
const userApiSource = readFileSync(
  resolve(process.cwd(), 'apps/web-antd/src/api/system/user/price-field.ts'),
  'utf8',
);
const userDetailSource = readFileSync(
  resolve(
    process.cwd(),
    'apps/web-antd/src/views/system/user/modules/user-detail-modal.vue',
  ),
  'utf8',
);
const userBatchEditSource = readFileSync(
  resolve(
    process.cwd(),
    'apps/web-antd/src/views/system/user/modules/batch-edit-form.vue',
  ),
  'utf8',
);
const roleApiSource = readFileSync(
  resolve(process.cwd(), 'apps/web-antd/src/api/system/role/index.ts'),
  'utf8',
);

describe('platform administrator tenant visit layout integration', () => {
  it('shows the entry only when tenant support, visit permission, and an authorized target are available', () => {
    expect(layoutSource).toContain(
      "hasAccessByCodes(['system:tenant:visit']) && isTenantEnable()",
    );
    expect(layoutSource).toContain('v-if="showTenantVisitEntry"');
    expect(layoutSource).toContain('hasAuthorizedTargetTenant.value');
    expect(layoutSource).toContain('getVisitTenantList');
    expect(layoutSource).toContain('tenants.value = []');
    expect(tenantApiSource).toContain("'/system/tenant/visit-list'");
    expect(layoutSource).not.toContain('getSimpleTenantList');
  });

  it('keeps tenant visit distinct from login tenant identity', () => {
    expect(layoutSource).toContain(':visit-tenant-id="activeTenantId"');
    expect(layoutSource).toContain('正在访问：{{ activeTenantName }}');
    expect(layoutSource).toContain('返回原租户');
    expect(requestSource).toContain("config.headers['tenant-id']");
    expect(requestSource).toContain("config.headers['visit-tenant-id']");
    expect(requestSource).toContain('TENANT_VISIT_FORBIDDEN_CODE = 902');
    expect(requestSource).toContain(
      'getBusinessErrorCode(response.data) === TENANT_VISIT_FORBIDDEN_CODE',
    );
    expect(requestSource).toContain("'tenant-visit-revoked'");
  });

  it('confirms potentially destructive navigation before changing tenant', () => {
    expect(layoutSource).toContain('Modal.confirm({');
    expect(layoutSource).toContain('未保存内容将会丢失');
    expect(layoutSource).toContain('applyTenantVisitTransition({');
  });

  it('gates scope configuration by platform tenant and the dedicated permission', () => {
    expect(userDetailSource).toContain(
      'Number(accessStore.tenantId) === SYSTEM_TENANT_ID',
    );
    expect(userDetailSource).toContain(
      'hasAccessByCodes([TENANT_VISIT_SCOPE_PERMISSION])',
    );
    expect(userDetailSource).toContain('<Radio value="CLEAR">暂不开放</Radio>');
    expect(userDetailSource).toContain('暂未开放跨租户访问');
    expect(userDetailSource).not.toContain(
      'hasEffectiveTenantVisitPermission.value',
    );
  });

  it('supports ALL, non-empty CUSTOM, and CLEAR scope saves', () => {
    expect(userDetailSource).toContain('scopeType: tenantVisitScopeType.value');
    expect(userDetailSource).toContain(
      "tenantVisitScopeType.value === 'CUSTOM'",
    );
    expect(userDetailSource).toContain('指定租户模式至少选择一个租户');
    expect(userDetailSource).toContain('clear: true');
    expect(userDetailSource).toContain('tenantVisitScope,');
  });

  it('supports atomic batch scope overwrite and blocks disabled users', () => {
    expect(userBatchEditSource).toContain('updateTenantVisitScope');
    expect(userBatchEditSource).toContain(
      "tenantVisitScopeMode.value === 'CLEAR'",
    );
    expect(userBatchEditSource).toContain('clear: true');
    expect(userBatchEditSource).toContain('disabledSelectedUsers');
    expect(userBatchEditSource).toContain('getUserTenantVisitScope');
    expect(userBatchEditSource).toContain('system:tenant:visit-scope');
    expect(userBatchEditSource).toContain('覆盖所选用户原有范围');
  });

  it('keeps the system-managed tenant visit role read-only', () => {
    expect(userDetailSource).toContain('role.managed');
    expect(userDetailSource).toContain('由租户访问范围自动维护');
    expect(roleApiSource).toContain("role.code !== 'tenant_visit_user'");
  });

  it('uses the protected scope query and the atomic role-permission save payload', () => {
    expect(userApiSource).toContain("'/system/user/tenant-visit-scope'");
    expect(userApiSource).toContain('tenantVisitScope?: TenantVisitScopeSave');
    expect(userApiSource).toContain("'/system/user/role-permissions'");
  });
});
