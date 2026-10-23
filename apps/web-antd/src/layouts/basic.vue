<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import type { SystemTenantApi } from '#/api/system/tenant';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { isTenantEnable, useTabs, useWatermark } from '@vben/hooks';
import { AntdProfileOutlined } from '@vben/icons';
import {
  BasicLayout,
  LockScreen,
  Notification,
  TenantDropdown,
  UserDropdown,
} from '@vben/layouts';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';
import { formatDateTime } from '@vben/utils';

import { Button, message, Modal, Tag } from 'ant-design-vue';

import {
  getUnreadNotifyMessageCount,
  getUnreadNotifyMessageList,
  updateAllNotifyMessageRead,
  updateNotifyMessageRead,
} from '#/api/system/notify/message';
import { getVisitTenantList } from '#/api/system/tenant';
import { $t } from '#/locales';
import { router } from '#/router';
import { useAuthStore } from '#/store';
import LoginForm from '#/views/_core/authentication/login.vue';
import FloatingAssistant from '#/views/erp/assistant/FloatingAssistant.vue';

import {
  applyTenantVisitTransition,
  hasVisitableTenant,
  isVisitingTenant,
  resolveActiveTenantId,
} from './tenant-visit';

const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const { hasAccessByCodes } = useAccess();
const { destroyWatermark, updateWatermark } = useWatermark();
const { closeOtherTabs, refreshTab } = useTabs();

const notifications = ref<NotificationItem[]>([]);
const unreadCount = ref(0);
const showDot = computed(() => unreadCount.value > 0);

const tenants = ref<SystemTenantApi.Tenant[]>([]);
const tenantVisitEnabled = computed(
  () => hasAccessByCodes(['system:tenant:visit']) && isTenantEnable(),
);
const hasAuthorizedTargetTenant = computed(() =>
  hasVisitableTenant(tenants.value, accessStore.tenantId),
);
const activeTenantId = computed(() =>
  resolveActiveTenantId(accessStore.tenantId, accessStore.visitTenantId),
);
const visitingTenant = computed(() =>
  isVisitingTenant(accessStore.tenantId, accessStore.visitTenantId),
);
const showTenantVisitEntry = computed(
  () =>
    tenantVisitEnabled.value &&
    (hasAuthorizedTargetTenant.value || visitingTenant.value),
);
const activeTenantName = computed(
  () =>
    tenants.value.find((tenant) => tenant.id === activeTenantId.value)?.name ||
    (activeTenantId.value ? `租户 ${activeTenantId.value}` : '未知租户'),
);

const menus = computed(() => [
  {
    handler: () => {
      router.push({ name: 'Profile' });
    },
    icon: AntdProfileOutlined,
    text: $t('ui.widgets.profile'),
  },
]);

const avatar = computed(() => {
  return userStore.userInfo?.avatar ?? preferences.app.defaultAvatar;
});

async function handleLogout() {
  await authStore.logout(false);
}

async function loadTenantList() {
  try {
    tenants.value = await getVisitTenantList();
  } catch {
    tenants.value = [];
    message.error('访问租户列表加载失败');
  }
}

async function handleTenantVisitRevoked() {
  try {
    await closeOtherTabs();
  } finally {
    window.location.reload();
  }
}

async function applyTenantChange(
  tenant: Pick<SystemTenantApi.Tenant, 'id' | 'name'>,
) {
  if (!tenant.id) {
    message.error('访问租户失败：租户信息无效');
    return;
  }
  const previousVisitTenantId = accessStore.visitTenantId;
  try {
    const nextVisitTenantId = await applyTenantVisitTransition({
      closeOtherTabs,
      currentVisitTenantId: previousVisitTenantId,
      loginTenantId: accessStore.tenantId,
      refreshTab,
      setVisitTenantId: (tenantId) => accessStore.setVisitTenantId(tenantId),
      targetTenantId: tenant.id,
    });
    message.success(
      nextVisitTenantId === null
        ? '已返回原租户'
        : `正在访问租户：${tenant.name}`,
    );
  } catch {
    message.error('访问租户失败，已恢复原访问状态');
  }
}

function confirmTenantChange(
  tenant: Pick<SystemTenantApi.Tenant, 'id' | 'name'>,
) {
  if (!tenant.id) {
    message.error('访问租户失败：租户信息无效');
    return;
  }
  const returningToLoginTenant = tenant.id === accessStore.tenantId;
  Modal.confirm({
    cancelText: '取消',
    content: returningToLoginTenant
      ? '返回原租户会关闭其他业务页签并刷新当前页面，未保存内容将会丢失。'
      : `访问“${tenant.name}”会关闭其他业务页签并刷新当前页面，未保存内容将会丢失。`,
    okText: returningToLoginTenant ? '确认返回' : '确认访问',
    onOk: () => applyTenantChange(tenant),
    title: returningToLoginTenant ? '返回原租户' : '访问租户',
  });
}

function handleTenantChange(tenant: SystemTenantApi.Tenant) {
  confirmTenantChange(tenant);
}

function handleReturnToLoginTenant() {
  const loginTenantId = accessStore.tenantId;
  if (!loginTenantId) {
    message.error('返回原租户失败：登录租户信息不存在');
    return;
  }
  const loginTenant = tenants.value.find(
    (tenant) => tenant.id === loginTenantId,
  );
  confirmTenantChange({
    id: loginTenantId,
    name: loginTenant?.name || `租户 ${loginTenantId}`,
  });
}

async function handleNotificationGetUnreadCount() {
  unreadCount.value = await getUnreadNotifyMessageCount();
}

async function handleNotificationGetList() {
  const list = await getUnreadNotifyMessageList();
  notifications.value = list.map((item) => ({
    avatar: preferences.app.defaultAvatar,
    date: formatDateTime(item.createTime) as string,
    id: item.id,
    isRead: false,
    message: item.templateContent,
    title: item.templateNickname,
  }));
}

function handleNotificationViewAll() {
  router.push({
    name: 'MyNotifyMessage',
  });
}

async function handleNotificationMakeAll() {
  await updateAllNotifyMessageRead();
  unreadCount.value = 0;
  notifications.value = [];
}

async function handleNotificationClear() {
  await handleNotificationMakeAll();
}

async function handleNotificationRead(item: NotificationItem) {
  if (!item.id) {
    return;
  }
  await updateNotifyMessageRead([item.id]);
  await handleNotificationGetUnreadCount();
  notifications.value = notifications.value.filter((n) => n.id !== item.id);
}

function handleNotificationOpen(open: boolean) {
  if (!open) {
    return;
  }
  handleNotificationGetList();
  handleNotificationGetUnreadCount();
}

onMounted(() => {
  window.addEventListener('tenant-visit-revoked', handleTenantVisitRevoked);
  handleNotificationGetUnreadCount();
  setInterval(
    () => {
      if (userStore.userInfo) {
        handleNotificationGetUnreadCount();
      }
    },
    1000 * 60 * 2,
  );
});

onBeforeUnmount(() => {
  window.removeEventListener('tenant-visit-revoked', handleTenantVisitRevoked);
});

watch(
  tenantVisitEnabled,
  (enabled) => {
    if (enabled) {
      void loadTenantList();
    } else {
      tenants.value = [];
    }
  },
  { immediate: true },
);

watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
  }),
  async ({ enable, content }) => {
    if (enable) {
      await updateWatermark({
        content:
          content ||
          `${userStore.userInfo?.id} - ${userStore.userInfo?.nickname}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <BasicLayout @clear-preferences-and-logout="handleLogout">
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :menus
        :text="userStore.userInfo?.nickname"
        :description="userStore.userInfo?.email"
        :tag-text="userStore.userInfo?.username"
        @logout="handleLogout"
      />
    </template>
    <template #notification>
      <Notification
        :dot="showDot"
        :notifications="notifications"
        @clear="handleNotificationClear"
        @make-all="handleNotificationMakeAll"
        @view-all="handleNotificationViewAll"
        @open="handleNotificationOpen"
        @read="handleNotificationRead"
      />
    </template>
    <template #header-right-1>
      <div v-if="showTenantVisitEntry" class="flex items-center gap-2">
        <Tag v-if="visitingTenant" color="orange">
          正在访问：{{ activeTenantName }}
        </Tag>
        <TenantDropdown
          :tenant-list="tenants"
          :visit-tenant-id="activeTenantId"
          @success="handleTenantChange"
        />
        <Button
          v-if="visitingTenant"
          size="small"
          type="link"
          @click="handleReturnToLoginTenant"
        >
          返回原租户
        </Button>
      </div>
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
  <FloatingAssistant />
</template>
