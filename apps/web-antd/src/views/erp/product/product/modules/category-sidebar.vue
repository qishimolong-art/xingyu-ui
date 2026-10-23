<script lang="ts" setup>
import type { ErpProductCategoryApi } from '#/api/erp/product/category';

import { computed, onMounted, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { handleTree } from '@vben/utils';

import { Button, Input, Spin, Tooltip, Tree } from 'ant-design-vue';

import { getProductCategorySimpleList } from '#/api/erp/product/category';

const ALL_CATEGORY_KEY = 'all';

const emit = defineEmits<{
  collapse: [];
  select: [category?: { categoryId?: number; categoryName?: string }];
}>();

const categoryList = ref<ErpProductCategoryApi.ProductCategory[]>([]);
const searchValue = ref('');
const loading = ref(false);
const selectedKeys = ref<(number | string)[]>([ALL_CATEGORY_KEY]);
const expandedKeys = ref<(number | string)[]>([]);

function matchCategory(
  item: ErpProductCategoryApi.ProductCategory,
  keyword: string,
) {
  const lowerKeyword = keyword.toLowerCase();
  return Boolean(
    item.name?.toLowerCase().includes(lowerKeyword) ||
    item.code?.toLowerCase().includes(lowerKeyword),
  );
}

function buildFilteredTree(
  nodes: ErpProductCategoryApi.ProductCategory[],
  keyword: string,
): ErpProductCategoryApi.ProductCategory[] {
  if (!keyword) {
    return nodes;
  }

  return nodes.reduce<ErpProductCategoryApi.ProductCategory[]>(
    (result, node) => {
      const children = buildFilteredTree(node.children ?? [], keyword);
      if (matchCategory(node, keyword) || children.length > 0) {
        result.push({
          ...node,
          children,
        });
      }
      return result;
    },
    [],
  );
}

const fullCategoryTree = computed(
  () =>
    handleTree(categoryList.value) as ErpProductCategoryApi.ProductCategory[],
);

const categoryTree = computed<any[]>(() =>
  buildFilteredTree(fullCategoryTree.value, searchValue.value.trim()),
);

function getTreeKeys(nodes: ErpProductCategoryApi.ProductCategory[]) {
  return nodes.reduce<(number | string)[]>((result, node) => {
    if (node.id !== undefined) {
      result.push(node.id);
    }
    result.push(...getTreeKeys(node.children ?? []));
    return result;
  }, []);
}

function handleSearchChange() {
  expandedKeys.value = getTreeKeys(categoryTree.value);
}

function handleSelectAll() {
  selectedKeys.value = [ALL_CATEGORY_KEY];
  emit('select');
}

function handleSelect(keys: (number | string)[], info: any) {
  const node = info?.node?.dataRef as
    | ErpProductCategoryApi.ProductCategory
    | undefined;
  if (!node?.id) {
    handleSelectAll();
    return;
  }
  selectedKeys.value = keys.length > 0 ? keys : [node.id];
  emit('select', {
    categoryId: node.id,
    categoryName: node.name,
  });
}

onMounted(async () => {
  try {
    loading.value = true;
    const data = await getProductCategorySimpleList();
    categoryList.value = data;
    handleSearchChange();
  } finally {
    loading.value = false;
  }
});

watch(searchValue, handleSearchChange);
</script>

<template>
  <div class="category-sidebar flex h-full min-h-0 flex-col">
    <div class="mb-3 flex flex-none items-center justify-between gap-2">
      <div class="min-w-0 text-base font-medium">配件分类</div>
      <Button
        size="small"
        type="text"
        title="隐藏分类"
        @click="emit('collapse')"
      >
        <template #icon>
          <IconifyIcon icon="lucide:panel-left-close" class="size-4" />
        </template>
      </Button>
    </div>

    <Input
      v-model:value="searchValue"
      allow-clear
      class="w-full flex-none"
      placeholder="搜索分类名称/编码"
    >
      <template #prefix>
        <IconifyIcon icon="lucide:search" class="size-4" />
      </template>
    </Input>

    <button
      class="category-all-node mt-3 flex h-8 w-full flex-none items-center gap-2 rounded px-2 text-left text-sm"
      :class="{ 'is-active': selectedKeys.includes(ALL_CATEGORY_KEY) }"
      type="button"
      @click="handleSelectAll"
    >
      <IconifyIcon icon="lucide:layers-3" class="size-4 flex-none" />
      <span class="min-w-0 flex-1 truncate">全部分类</span>
    </button>

    <div class="category-tree-scroll mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
      <Spin :spinning="loading" wrapper-class-name="w-full">
        <Tree
          v-if="categoryTree.length > 0"
          v-model:expanded-keys="expandedKeys"
          :block-node="true"
          class="product-category-tree pt-1"
          :default-expand-all="!searchValue"
          :field-names="{ title: 'name', key: 'id', children: 'children' }"
          :selected-keys="selectedKeys"
          :tree-data="categoryTree"
          @select="handleSelect"
        >
          <template #title="node">
            <Tooltip
              :title="node.code ? `${node.name}（${node.code}）` : node.name"
              placement="topLeft"
            >
              <span class="category-tree-node-title">
                <span class="category-name">{{ node.name }}</span>
                <span v-if="node.code" class="category-code">{{
                  node.code
                }}</span>
              </span>
            </Tooltip>
          </template>
        </Tree>
        <div v-else-if="!loading" class="py-4 text-center text-gray-500">
          暂无分类
        </div>
      </Spin>
    </div>
  </div>
</template>

<style scoped>
.category-sidebar {
  border-right: 1px solid hsl(var(--border));
  background: hsl(var(--background));
  padding: 12px;
}

.category-tree-scroll {
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.category-tree-scroll::-webkit-scrollbar {
  width: 6px;
}

.category-tree-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: hsl(var(--border));
}

.category-all-node {
  border: 0;
  background: transparent;
  color: hsl(var(--foreground));
  cursor: pointer;
}

.category-all-node:hover,
.category-all-node.is-active {
  background: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}

:deep(.product-category-tree .ant-tree-treenode) {
  width: 100%;
}

:deep(.product-category-tree .ant-tree-node-content-wrapper) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

:deep(.product-category-tree .ant-tree-title) {
  display: block;
  min-width: 0;
  overflow: hidden;
}

.category-tree-node-title {
  display: flex;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.category-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-code {
  flex: none;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}
</style>
