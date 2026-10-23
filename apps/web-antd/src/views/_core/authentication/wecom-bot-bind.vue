<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { isTenantEnable } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import { Result, Spin } from 'ant-design-vue';

import { weComBotBind, weComBotBindAuthorizeUrl } from '#/api/core/auth';

defineOptions({ name: 'WeComBotBind' });

const DEFAULT_TENANT_ID = 1;
const route = useRoute();
const accessStore = useAccessStore();
const loading = ref(true);
const status = ref<'error' | 'success'>('success');
const title = ref('正在完成身份绑定');
const message = ref('请稍候，不要关闭页面');

function queryValue(key: string) {
  const value = route.query[key];
  const routeValue = Array.isArray(value) ? value[0] : value;
  return (
    (typeof routeValue === 'string' && routeValue) ||
    new URLSearchParams(window.location.search).get(key) ||
    undefined
  );
}

function syncTenant() {
  if (!isTenantEnable()) return;
  const value = Number(queryValue('tenantId'));
  const tenantId =
    Number.isFinite(value) && value > 0 ? value : DEFAULT_TENANT_ID;
  if (accessStore.tenantId !== tenantId) accessStore.setTenantId(tenantId);
}

function isWeComBrowser() {
  return /wxwork/i.test(window.navigator.userAgent);
}

function showError(text: string) {
  status.value = 'error';
  title.value = '绑定未完成';
  message.value = text;
}

async function bind() {
  syncTenant();
  const ticket = queryValue('ticket');
  const code = queryValue('code');
  const state = queryValue('state');
  if (code && state) {
    try {
      const result = await weComBotBind({ code, state });
      status.value = 'success';
      title.value = `身份绑定成功${result.nickname ? `：${result.nickname}` : ''}`;
      message.value = result.message;
    } catch (error: any) {
      showError(error?.message || '绑定失败，请返回企业微信机器人重新发起绑定');
    }
    return;
  }
  if (!ticket) {
    showError('绑定链接参数不完整，请返回企业微信机器人重新提问');
    return;
  }
  if (!isWeComBrowser()) {
    showError('请在企业微信内打开此绑定链接');
    return;
  }
  try {
    window.location.href = await weComBotBindAuthorizeUrl(ticket);
  } catch (error: any) {
    showError(error?.message || '绑定链接已失效，请返回企业微信机器人重新提问');
  }
}

onMounted(async () => {
  try {
    await bind();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="flex min-h-[260px] items-center justify-center px-4">
    <Spin v-if="loading" tip="正在绑定 ERP 身份…" />
    <Result v-else :status="status" :sub-title="message" :title="title" />
  </div>
</template>
