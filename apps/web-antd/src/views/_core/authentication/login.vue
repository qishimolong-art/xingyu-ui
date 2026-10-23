<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { AuthApi } from '#/api/core/auth';

import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { isTenantEnable } from '@vben/hooks';
import { $t } from '@vben/locales';
import { useAccessStore } from '@vben/stores';

import {
  getTenantByWebsite,
  getTenantSimpleList,
  socialAuthRedirect,
} from '#/api/core/auth';
import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const { query } = useRoute();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const tenantEnable = isTenantEnable();
const DEFAULT_TENANT_ID = 1;

const loginRef = ref();

function getRouteTenantId() {
  const tenantId = Array.isArray(query.tenantId)
    ? query.tenantId[0]
    : query.tenantId;
  const value = typeof tenantId === 'string' ? tenantId.trim() : '';
  return value || null;
}

const tenantList = ref<AuthApi.TenantResult[]>([]);

async function fetchTenantList() {
  if (!tenantEnable) {
    return;
  }

  try {
    const websiteTenantPromise = getTenantByWebsite(window.location.hostname);
    tenantList.value = await getTenantSimpleList();

    const routeTenantId = getRouteTenantId();
    let tenantId: null | number = routeTenantId
      ? Number(routeTenantId)
      : DEFAULT_TENANT_ID;
    if (!Number.isFinite(tenantId)) {
      tenantId = null;
    }
    if (!tenantId) {
      const websiteTenant = await websiteTenantPromise;
      if (websiteTenant?.id) {
        tenantId = websiteTenant.id;
      }
    }
    if (!tenantId && accessStore.tenantId) {
      tenantId = accessStore.tenantId;
    }
    if (!tenantId && tenantList.value?.[0]?.id) {
      tenantId = tenantList.value[0].id;
    }

    accessStore.setTenantId(tenantId);
  } catch (error) {
    console.error('获取租户列表失败:', error);
  }
}

async function handleLogin(values: any) {
  await authStore.authLogin('username', values);
}

const redirect = query?.redirect;
async function handleThirdLogin(type: number) {
  if (type <= 0) {
    return;
  }
  const redirectUri = `${location.origin}/auth/social-login?${encodeURIComponent(
    `type=${type}&redirect=${redirect || '/'}`,
  )}`;
  window.location.href = await socialAuthRedirect(type, redirectUri);
}

onMounted(() => {
  fetchTenantList();
});

const formSchema = computed((): VbenFormSchema[] => [
  {
    component: 'VbenInput',
    componentProps: {
      placeholder: $t('authentication.usernameTip'),
    },
    fieldName: 'username',
    label: $t('authentication.username'),
    rules: z
      .string()
      .min(1, { message: $t('authentication.usernameTip') })
      .default(import.meta.env.VITE_APP_DEFAULT_USERNAME),
  },
  {
    component: 'VbenInputPassword',
    componentProps: {
      placeholder: $t('authentication.passwordTip'),
    },
    fieldName: 'password',
    label: $t('authentication.password'),
    rules: z
      .string()
      .min(1, { message: $t('authentication.passwordTip') })
      .default(import.meta.env.VITE_APP_DEFAULT_PASSWORD),
  },
]);
</script>

<template>
  <div>
    <AuthenticationLogin
      ref="loginRef"
      :form-schema="formSchema"
      :loading="authStore.loginLoading"
      :show-register="false"
      @submit="handleLogin"
      @third-login="handleThirdLogin"
    />
  </div>
</template>
