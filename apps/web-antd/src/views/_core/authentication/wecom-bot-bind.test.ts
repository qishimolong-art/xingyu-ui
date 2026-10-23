import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(currentDir, 'wecom-bot-bind.vue'), 'utf8');
const bridge = readFileSync(
  join(currentDir, '../../../../public/wecom-bot-bind.html'),
  'utf8',
);

describe('企业微信问数机器人绑定页', () => {
  it('授权前由无井号桥接页直接发起 OAuth，回调后再进入结果路由', () => {
    expect(bridge).toContain("new URL('/auth/wecom-bot-bind'");
    expect(bridge).toContain('window.location.search');
    expect(bridge).toContain('window.location.hash');
    expect(bridge).toContain('if (code && state)');
    expect(bridge).toContain(
      "'/admin-api/erp/assistant/wecom-bot/bind-authorize-url?ticket='",
    );
    expect(bridge).toContain("headers: { 'tenant-id': String(tenantId) }");
    expect(bridge).toContain('window.location.replace(result.data)');
  });

  it('只调用绑定接口且不会写入 ERP 登录令牌', () => {
    expect(page).toContain('weComBotBindAuthorizeUrl(ticket)');
    expect(page).toContain('weComBotBind({ code, state })');
    expect(page).not.toContain('authStore');
    expect(page).not.toContain('setAccessToken');
  });

  it('非企业微信浏览器给出明确提示', () => {
    expect(page).toContain('/wxwork/i');
    expect(page).toContain('请在企业微信内打开此绑定链接');
  });
});
