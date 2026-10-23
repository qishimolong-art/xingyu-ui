<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { AuthApi } from '#/api/core/auth';

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthenticationLogin, Verification, z } from '@vben/common-ui';
import { isCaptchaEnable, isTenantEnable } from '@vben/hooks';
import { $t } from '@vben/locales';
import { useAccessStore } from '@vben/stores';
import { getUrlValue } from '@vben/utils';

import {
  checkCaptcha,
  getCaptcha,
  getTenantByWebsite,
  getTenantSimpleList,
} from '#/api/core/auth';
import { useAuthStore } from '#/store';

defineOptions({ name: 'SocialLogin' });

const authStore = useAuthStore();
const accessStore = useAccessStore();
const { query } = useRoute();
const router = useRouter();
const tenantEnable = isTenantEnable();
const captchaEnable = isCaptchaEnable();
const DEFAULT_TENANT_ID = 1;

const loginRef = ref();
const verifyRef = ref();
const captchaType = 'blockPuzzle';

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
    loginRef.value.getFormApi().setFieldValue('tenantId', tenantId?.toString());
  } catch (error) {
    console.error('获取租户列表失败:', error);
  }
}

const socialType = Number(getUrlValue('type'));
const redirect = getUrlValue('redirect');
const socialCode = query?.code as string;
const socialState = query?.state as string;

async function tryLogin() {
  if (redirect) {
    await router.replace({
      query: {
        ...query,
        redirect: encodeURIComponent(redirect),
      },
    });
  }

  await authStore.authLogin('social', {
    type: socialType,
    code: socialCode,
    state: socialState,
  });
}

async function handleLogin(values: any) {
  if (captchaEnable) {
    verifyRef.value.show();
    return;
  }
  await authStore.authLogin('username', {
    ...values,
    socialType,
    socialCode,
    socialState,
  });
}

async function handleVerifySuccess({ captchaVerification }: any) {
  await authStore.authLogin('username', {
    ...(await loginRef.value.getFormApi().getValues()),
    captchaVerification,
    socialType,
    socialCode,
    socialState,
  });
}

onMounted(async () => {
  await fetchTenantList();
  await tryLogin();
});

const formSchema = computed((): VbenFormSchema[] => [
  {
    component: 'VbenSelect',
    componentProps: {
      options: tenantList.value.map((item) => ({
        label: item.name,
        value: item.id.toString(),
      })),
      placeholder: $t('authentication.tenantTip'),
    },
    fieldName: 'tenantId',
    label: $t('authentication.tenant'),
    rules: z.string().min(1, { message: $t('authentication.tenantTip') }),
    dependencies: {
      triggerFields: ['tenantId'],
      if: tenantEnable,
      trigger(values) {
        if (values.tenantId) {
          accessStore.setTenantId(Number(values.tenantId));
        }
      },
    },
  },
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
      :show-code-login="false"
      :show-qrcode-login="false"
      :show-third-party-login="false"
      :show-register="false"
      @submit="handleLogin"
    />
    <Verification
      ref="verifyRef"
      v-if="captchaEnable"
      :captcha-type="captchaType"
      :check-captcha-api="checkCaptcha"
      :get-captcha-api="getCaptcha"
      :img-size="{ width: '400px', height: '200px' }"
      mode="pop"
      @on-success="handleVerifySuccess"
    />
  </div>
</template>
