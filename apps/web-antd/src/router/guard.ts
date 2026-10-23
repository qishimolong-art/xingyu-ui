import type { Router } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { $t } from '@vben/locales';
import { preferences } from '@vben/preferences';
import { useAccessStore, useDictStore, useUserStore } from '@vben/stores';
import { startProgress, stopProgress } from '@vben/utils';

import { message } from 'ant-design-vue';

import { getSimpleDictDataList } from '#/api/system/dict/data';
import { accessRoutes, coreRouteNames } from '#/router/routes';
import { useAuthStore } from '#/store';

import { generateAccess } from './access';

let accessInitPromise: Promise<void> | null = null;

function setupCommonGuard(router: Router) {
  const loadedPaths = new Set<string>();

  router.beforeEach((to) => {
    to.meta.loaded = loadedPaths.has(to.path);
    if (!to.meta.loaded && preferences.transition.progress) {
      startProgress();
    }
    return true;
  });

  router.afterEach((to) => {
    loadedPaths.add(to.path);
    if (preferences.transition.progress) {
      stopProgress();
    }
  });
}

function setupAccessGuard(router: Router) {
  router.beforeEach(async (to, from) => {
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    const authStore = useAuthStore();
    const dictStore = useDictStore();

    if (coreRouteNames.includes(to.name as string)) {
      if (to.path === LOGIN_PATH && accessStore.accessToken) {
        return decodeURIComponent(
          (to.query?.redirect as string) ||
            userStore.userInfo?.homePath ||
            preferences.app.defaultHomePath,
        );
      }
      return true;
    }

    if (!accessStore.accessToken) {
      if (to.meta.ignoreAccess) {
        return true;
      }
      if (to.fullPath !== LOGIN_PATH) {
        return {
          path: LOGIN_PATH,
          query:
            to.fullPath === preferences.app.defaultHomePath
              ? {}
              : { redirect: encodeURIComponent(to.fullPath) },
          replace: true,
        };
      }
      return to;
    }

    if (accessStore.isAccessChecked) {
      return true;
    }

    if (!accessInitPromise) {
      accessInitPromise = (async () => {
        const loading = message.loading({
          content: `${$t('common.loadingMenu')}...`,
        });
        try {
          void dictStore
            .setDictCacheByApi(getSimpleDictDataList)
            .catch((error) => {
              console.warn('[Dict] load simple dict data failed:', error);
            });
          const authPermissionInfo = authStore.userInfoLoaded
            ? null
            : await authStore.fetchUserInfo();
          const userInfo = authPermissionInfo?.user ?? userStore.userInfo;
          const userRoles =
            authPermissionInfo?.roles ?? userStore.userRoles ?? [];

          const { accessibleMenus, accessibleRoutes } = await generateAccess({
            roles: userRoles,
            router,
            routes: accessRoutes,
          });

          accessStore.setAccessMenus(accessibleMenus);
          accessStore.setAccessRoutes(accessibleRoutes);
          accessStore.setIsAccessChecked(true);
          userStore.setUserRoles(userRoles);
          if (userInfo) {
            userStore.setUserInfo(userInfo);
          }
        } finally {
          loading();
        }
      })().finally(() => {
        accessInitPromise = null;
      });
    }

    await accessInitPromise;

    const userInfo = userStore.userInfo;
    const redirectPath = (from.query.redirect ??
      (to.path === preferences.app.defaultHomePath
        ? userInfo?.homePath || preferences.app.defaultHomePath
        : to.fullPath)) as string;

    return {
      ...router.resolve(decodeURIComponent(redirectPath)),
      replace: true,
    };
  });
}

function createRouterGuard(router: Router) {
  setupCommonGuard(router);
  setupAccessGuard(router);
}

export { createRouterGuard };
