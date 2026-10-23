<script lang="ts" setup>
import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';

import { computed } from 'vue';

import { Tooltip } from 'ant-design-vue';

import {
  getPurchaseInStatusLegend,
  getPurchaseInStatusMarkers,
} from './purchase-in-status';

const props = withDefaults(
  defineProps<{
    mode?: 'compact' | 'detail' | 'explanation' | 'legend';
    row?: ErpPurchaseInApi.PurchaseIn;
  }>(),
  {
    mode: 'compact',
    row: undefined,
  },
);

const markers = computed(() =>
  props.mode === 'legend' || props.mode === 'explanation'
    ? getPurchaseInStatusLegend()
    : props.row
      ? getPurchaseInStatusMarkers(props.row)
      : [],
);
const description = computed(() =>
  markers.value.map((marker) => marker.description).join('；'),
);
const ariaLabel = computed(() =>
  props.mode === 'explanation'
    ? markers.value.map((marker) => marker.explanation).join('；')
    : description.value
      ? `业务状态：${description.value}`
      : '暂无关联业务',
);
</script>

<template>
  <Tooltip
    v-if="mode === 'compact' && markers.length > 0"
    :title="description"
    placement="top"
  >
    <span
      :aria-label="ariaLabel"
      class="purchase-in-status-dots purchase-in-status-dots--compact"
      role="img"
      tabindex="0"
      @click.stop
      @keydown.stop
    >
      <span
        v-for="marker in markers"
        :key="marker.key"
        aria-hidden="true"
        class="purchase-in-status-dot"
        :class="`purchase-in-status-dot--${marker.colorToken}`"
      ></span>
    </span>
  </Tooltip>

  <ul
    v-else-if="mode === 'explanation' && markers.length > 0"
    :aria-label="ariaLabel"
    class="purchase-in-status-explanation"
  >
    <li
      v-for="marker in markers"
      :key="marker.key"
      class="purchase-in-status-explanation__item"
    >
      <span
        aria-hidden="true"
        class="purchase-in-status-dot"
        :class="`purchase-in-status-dot--${marker.colorToken}`"
      ></span>
      <span class="purchase-in-status-explanation__label">
        {{ marker.label }}
      </span>
      <span class="purchase-in-status-explanation__text">
        {{ marker.explanation }}
      </span>
    </li>
  </ul>

  <span
    v-else-if="mode !== 'compact' && markers.length > 0"
    :aria-label="ariaLabel"
    class="purchase-in-status-dots purchase-in-status-dots--explained"
    role="list"
  >
    <span
      v-for="marker in markers"
      :key="marker.key"
      class="purchase-in-status-item"
      role="listitem"
      :title="mode === 'legend' ? marker.explanation : marker.description"
    >
      <span
        aria-hidden="true"
        class="purchase-in-status-dot"
        :class="`purchase-in-status-dot--${marker.colorToken}`"
      ></span>
      <span>{{ marker.label }}</span>
    </span>
  </span>

  <span v-else-if="mode === 'detail'" class="purchase-in-status-empty">
    暂无关联业务
  </span>
</template>

<style scoped>
.purchase-in-status-dots,
.purchase-in-status-explanation {
  --purchase-in-status-success: #52c41a;
  --purchase-in-status-primary: #1677ff;
  --purchase-in-status-warning: #fa8c16;
  --purchase-in-status-purple: #722ed1;

  display: inline-flex;
  align-items: center;
}

:global(html.dark) .purchase-in-status-dots,
:global(html.dark) .purchase-in-status-explanation {
  --purchase-in-status-success: #95de64;
  --purchase-in-status-primary: #69b1ff;
  --purchase-in-status-warning: #ffc069;
  --purchase-in-status-purple: #b37feb;
}

.purchase-in-status-dots--compact {
  flex-shrink: 0;
  gap: 5px;
  padding: 3px 2px;
  border-radius: 4px;
  cursor: help;
  line-height: 1;
  outline: none;
}

.purchase-in-status-dots--compact:focus-visible,
.purchase-in-status-dots--compact:hover {
  box-shadow: 0 0 0 2px hsl(var(--ring) / 35%);
}

.purchase-in-status-dots--explained {
  flex-wrap: wrap;
  gap: 5px 16px;
  font-size: 12px;
  line-height: 20px;
}

.purchase-in-status-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.purchase-in-status-explanation {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 18px;
  list-style: none;
}

.purchase-in-status-explanation__item {
  display: grid;
  grid-template-columns: 8px 42px minmax(0, 1fr);
  align-items: start;
  gap: 0 6px;
}

.purchase-in-status-explanation__item .purchase-in-status-dot {
  margin-top: 5px;
}

.purchase-in-status-explanation__label {
  color: hsl(var(--foreground));
  font-weight: 600;
  white-space: nowrap;
}

.purchase-in-status-explanation__text {
  min-width: 0;
}

.purchase-in-status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border: 1px solid rgb(255 255 255 / 65%);
  border-radius: 999px;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 8%);
}

.purchase-in-status-dot--success {
  background: var(--purchase-in-status-success);
}

.purchase-in-status-dot--primary {
  background: var(--purchase-in-status-primary);
}

.purchase-in-status-dot--warning {
  background: var(--purchase-in-status-warning);
}

.purchase-in-status-dot--purple {
  background: var(--purchase-in-status-purple);
}

.purchase-in-status-empty {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}
</style>
