<script lang="ts" setup>
import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Menu } from 'ant-design-vue';

import BaseDataGrid from '../components/BaseDataGrid.vue';
import {
  BASE_OPTION_GROUPS,
  BASE_OPTION_ITEMS,
  BASE_OPTION_OPEN_KEYS,
} from './data';

defineOptions({ name: 'ErpBaseOptions' });

const openKeys = ref(BASE_OPTION_OPEN_KEYS);
const activeKey = ref(BASE_OPTION_ITEMS[0]!.key);

const activeOption = computed(
  () => BASE_OPTION_ITEMS.find((item) => item.key === activeKey.value)!,
);

function handleMenuClick({ key }: { key: number | string }) {
  activeKey.value = String(key);
}
</script>

<template>
  <Page auto-content-height>
    <div class="base-options-layout">
      <aside class="base-options-nav">
        <header class="base-options-nav__header">
          <span class="base-options-nav__title">选项分类</span>
        </header>
        <Menu
          class="base-options-nav__menu"
          mode="inline"
          :selected-keys="[activeKey]"
          :open-keys="openKeys"
          @click="handleMenuClick"
          @open-change="
            (keys: (string | number)[]) => {
              openKeys = keys.map(String);
            }
          "
        >
          <Menu.SubMenu
            v-for="menu in BASE_OPTION_GROUPS"
            :key="menu.key"
            :title="menu.title"
          >
            <Menu.SubMenu
              v-for="form in menu.forms"
              :key="form.key"
              :title="form.title"
            >
              <Menu.Item v-for="item in form.items" :key="item.key">
                {{ item.title }}
              </Menu.Item>
            </Menu.SubMenu>
          </Menu.SubMenu>
        </Menu>
      </aside>
      <main class="base-options-content">
        <BaseDataGrid
          embedded
          :key="activeOption.key"
          :title="activeOption.title"
          :type="activeOption.type"
        />
      </main>
    </div>
  </Page>
</template>

<style scoped>
.base-options-layout {
  display: flex;
  gap: 12px;
  height: 100%;
  min-height: 0;
  font-size: 12px;
}

.base-options-nav {
  display: flex;
  flex-direction: column;
  width: 220px;
  min-width: 220px;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.base-options-nav__header {
  display: flex;
  align-items: center;
  min-height: 42px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.base-options-nav__title {
  position: relative;
  padding-left: 10px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.base-options-nav__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 3px;
}

.base-options-nav__menu {
  flex: 1;
  padding: 6px;
  overflow: auto;
  font-size: 12px;
  background: transparent;
  border-inline-end: 0 !important;
}

.base-options-nav__menu :deep(.ant-menu-submenu-title),
.base-options-nav__menu :deep(.ant-menu-item) {
  height: 32px;
  margin-block: 1px;
  line-height: 32px;
  border-radius: 5px;
}

.base-options-nav__menu :deep(.ant-menu-submenu-title) {
  font-size: 12px;
  font-weight: 500;
}

.base-options-nav__menu :deep(.ant-menu-item) {
  font-size: 12px;
}

.base-options-nav__menu :deep(.ant-menu-item-selected) {
  font-weight: 600;
}

.base-options-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

@media (max-width: 767px) {
  .base-options-layout {
    flex-direction: column;
    height: auto;
    min-height: 100%;
  }

  .base-options-nav {
    width: 100%;
    min-width: 0;
    max-height: 280px;
  }

  .base-options-content {
    min-height: 520px;
  }
}
</style>
