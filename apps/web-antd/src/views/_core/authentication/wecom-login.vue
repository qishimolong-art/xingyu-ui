<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { isTenantEnable } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import { Spin } from 'ant-design-vue';

import { weComAuthRedirect } from '#/api/core/auth';
import { useAuthStore } from '#/store';

defineOptions({ name: 'WeComLogin' });

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const loading = ref(true);
const tenantEnable = isTenantEnable();
const DEFAULT_TENANT_ID = 1;
const WECOM_WORKBENCH_REDIRECTS: Record<string, string> = {
  'sale-delivery': '/wecom/sale-delivery?wecomWorkbench=1',
  'sale-pick': '/wecom/sale-pick?wecomWorkbench=1',
};
const WECOM_WORKBENCH_CLIENT_KEYS: Record<string, string> = {
  'sale-delivery': 'sale-delivery',
  'sale-pick': 'sale-pick',
};

function getQueryString(key: string): string | undefined {
  const value = route.query[key];
  const routeValue = Array.isArray(value) ? value[0] : value;
  if (typeof routeValue === 'string' && routeValue) {
    return routeValue;
  }
  return new URLSearchParams(window.location.search).get(key) || undefined;
}

function getWorkbenchRedirectPath() {
  const workbench = getQueryString('workbench');
  const redirectPath = workbench
    ? WECOM_WORKBENCH_REDIRECTS[workbench]
    : undefined;
  if (!redirectPath || workbench !== 'sale-pick') {
    return redirectPath;
  }
  const taskId = getQueryString('taskId');
  return taskId
    ? `${redirectPath}&taskId=${encodeURIComponent(taskId)}`
    : redirectPath;
}

function getWorkbenchClientKey() {
  const workbench = getQueryString('workbench');
  return workbench ? WECOM_WORKBENCH_CLIENT_KEYS[workbench] : undefined;
}

function getRedirectPath() {
  return getWorkbenchRedirectPath() || getQueryString('redirect') || '/';
}

function decodeRedirectPath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseTenantId(value?: string) {
  const tenantId = Number(value);
  if (Number.isFinite(tenantId) && tenantId > 0) {
    return tenantId;
  }
  return null;
}

function syncTenantId() {
  if (!tenantEnable) {
    return null;
  }
  const tenantId =
    parseTenantId(getQueryString('tenantId')) || DEFAULT_TENANT_ID;
  if (accessStore.tenantId !== tenantId) {
    accessStore.setTenantId(tenantId);
  }
  return tenantId;
}

function isWeComBrowser() {
  return /wxwork/i.test(window.navigator.userAgent);
}

function buildRedirectUri(tenantId?: null | number) {
  const params = new URLSearchParams();
  Object.entries(route.query).forEach(([key, value]) => {
    if (key === 'code' || key === 'state') {
      return;
    }
    const item = Array.isArray(value) ? value[0] : value;
    if (typeof item === 'string' && item) {
      params.set(key, item);
    }
  });
  if (tenantId) {
    params.set('tenantId', String(tenantId));
  }
  const queryString = params.toString();
  const callbackPath = `${route.path}${queryString ? `?${queryString}` : ''}`;
  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin)
    .toString()
    .replace(/\/$/, '');

  if (getWorkbenchClientKey()) {
    return `${baseUrl}/wecom-login.html${queryString ? `?${queryString}` : ''}`;
  }

  if (import.meta.env.VITE_ROUTER_HISTORY === 'hash') {
    return `${baseUrl}/#${callbackPath}`;
  }

  return `${baseUrl}${callbackPath}`;
}

async function fallbackToLogin(tenantId?: null | number) {
  const query: Record<string, string> = {
    redirect: encodeURIComponent(getRedirectPath()),
  };
  if (tenantId) {
    query.tenantId = String(tenantId);
  }
  await router.replace({
    path: LOGIN_PATH,
    query,
  });
}

async function handleWeComLogin() {
  const tenantId = syncTenantId();
  const code = getQueryString('code');
  const state = getQueryString('state');
  if (code && state) {
    try {
      await authStore.authLogin('wecom', { code, state }, async () => {
        await router.replace(decodeRedirectPath(getRedirectPath()));
      });
    } catch {
      await fallbackToLogin(tenantId);
    }
    return;
  }

  if (!isWeComBrowser()) {
    await fallbackToLogin(tenantId);
    return;
  }

  try {
    window.location.href = await weComAuthRedirect(
      buildRedirectUri(tenantId),
      getWorkbenchClientKey(),
    );
  } catch {
    await fallbackToLogin(tenantId);
  }
}

onMounted(async () => {
  try {
    await handleWeComLogin();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="flex min-h-[220px] items-center justify-center">
    <Spin v-if="loading" />
  </div>
</template>
