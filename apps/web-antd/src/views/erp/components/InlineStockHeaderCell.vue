<script lang="ts" setup>
import { ref, watch } from 'vue';

import { Button, Input, Popover } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    field: string;
    filterOpen?: boolean;
    filterValue?: string;
    filterable?: boolean;
    sortActive?: boolean;
    sortDirection?: 'asc' | 'desc';
    sortable?: boolean;
    title: string;
  }>(),
  {
    filterOpen: false,
    filterValue: '',
    filterable: false,
    sortActive: false,
    sortDirection: undefined,
    sortable: false,
  },
);

const emit = defineEmits<{
  'apply-filter': [field: string, value: string];
  'clear-all-filters': [];
  'filter-open-change': [field: string, open: boolean];
  sort: [field: string];
}>();

const draftValue = ref(props.filterValue);

watch(
  () => [props.filterOpen, props.filterValue] as const,
  ([open, value]) => {
    if (open) draftValue.value = value || '';
  },
);

function applyFilter() {
  emit('apply-filter', props.field, draftValue.value);
  emit('filter-open-change', props.field, false);
}

function clearFilter() {
  draftValue.value = '';
  applyFilter();
}

function clearAllFilters() {
  draftValue.value = '';
  emit('clear-all-filters');
  emit('filter-open-change', props.field, false);
}

function handleSort() {
  if (props.sortable) emit('sort', props.field);
}
</script>

<template>
  <div
    class="inline-stock-header-cell"
    :class="{ 'inline-stock-header-cell--sortable': sortable }"
    :data-inline-stock-header-field="field"
    @click="handleSort"
  >
    <span class="inline-stock-header-cell__title" :title="title">
      {{ title }}
    </span>
    <span
      v-if="sortable"
      class="inline-stock-header-cell__sort"
      :class="{ 'inline-stock-header-cell__sort--active': sortActive }"
      :aria-label="
        sortActive
          ? `${title}${sortDirection === 'asc' ? '升序' : '降序'}`
          : `${title}可排序`
      "
    >
      {{ sortActive ? (sortDirection === 'asc' ? '▲' : '▼') : '↕' }}
    </span>
    <Popover
      v-if="filterable"
      :open="filterOpen"
      placement="bottomRight"
      trigger="click"
      overlay-class-name="inline-stock-header-filter-popover"
      @open-change="(open) => emit('filter-open-change', field, open)"
    >
      <template #content>
        <div
          class="inline-stock-header-filter-panel"
          :data-inline-stock-filter-field="field"
          @click.stop
          @keydown.stop
        >
          <Input
            v-model:value="draftValue"
            allow-clear
            :placeholder="`筛选${title}`"
            @keydown.enter.stop.prevent="applyFilter"
          />
          <div class="inline-stock-header-filter-panel__actions">
            <Button size="small" @click.stop="clearFilter">清空本列</Button>
            <Button size="small" @click.stop="clearAllFilters">
              清空全部
            </Button>
            <Button size="small" type="primary" @click.stop="applyFilter">
              筛选
            </Button>
          </div>
        </div>
      </template>
      <button
        type="button"
        class="inline-stock-header-cell__filter"
        :class="{
          'inline-stock-header-cell__filter--active': Boolean(filterValue),
        }"
        :aria-label="`${title}筛选`"
        @click.stop
        @keydown.stop
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 3h12L9.4 8.2v3.6L6.6 13V8.2L2 3Z" />
        </svg>
      </button>
    </Popover>
  </div>
</template>

<style scoped>
.inline-stock-header-cell {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  gap: 4px;
}

.inline-stock-header-cell--sortable {
  cursor: pointer;
  user-select: none;
}

.inline-stock-header-cell__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.inline-stock-header-cell__sort {
  flex: none;
  color: #94a3b8;
  font-size: 10px;
}

.inline-stock-header-cell__sort--active {
  color: #1677ff;
}

.inline-stock-header-cell__filter {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 2px;
  color: #94a3b8;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 3px;
}

.inline-stock-header-cell__filter:hover,
.inline-stock-header-cell__filter--active {
  color: #1677ff;
  background: #eaf2ff;
}

.inline-stock-header-cell__filter svg {
  width: 13px;
  height: 13px;
  fill: currentColor;
}

.inline-stock-header-filter-panel {
  width: 260px;
  padding: 2px;
}

.inline-stock-header-filter-panel__actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 10px;
}

:global(.inline-stock-header-filter-popover .ant-popover-inner) {
  padding: 10px;
}
</style>
