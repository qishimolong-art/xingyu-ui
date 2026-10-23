import type { FormRenderProps } from '../types';

import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue';

import {
  breakpointsTailwind,
  useBreakpoints,
  useElementVisibility,
} from '@vueuse/core';

export function useExpandable(props: FormRenderProps) {
  const wrapperRef = useTemplateRef<HTMLElement>('wrapperRef');
  const isVisible = useElementVisibility(wrapperRef);
  const rowMapping = ref<Record<number, number>>({});
  const isCalculated = ref(false);

  const breakpoints = useBreakpoints(breakpointsTailwind);

  const keepFormItemIndex = computed(() => {
    const rows = props.collapsedRows ?? 1;
    const mapping = rowMapping.value;
    let maxItem = 0;
    for (let index = 1; index <= rows; index++) {
      maxItem += mapping?.[index] ?? 0;
    }
    return maxItem - 1 || 1;
  });

  watch(
    [
      () => props.showCollapseButton,
      () => breakpoints.active().value,
      () => props.schema?.length,
      () => isVisible.value,
    ],
    async ([val]) => {
      if (val) {
        rowMapping.value = {};
        isCalculated.value = false;
        await calculateRowMapping();
      }
    },
  );

  function waitForLayout() {
    if (typeof window === 'undefined' || !window.requestAnimationFrame) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }

  async function calculateRowMapping() {
    if (!props.showCollapseButton) {
      return;
    }

    await nextTick();
    await waitForLayout();

    const container = wrapperRef.value;
    if (!container) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) {
      return;
    }

    const rows: { bottom: number; count: number; top: number }[] = [];
    const formItems = [...container.children]
      .map((el) => {
        const itemRect = el.getBoundingClientRect();
        return {
          bottom: itemRect.bottom - containerRect.top,
          height: itemRect.height,
          top: itemRect.top - containerRect.top,
          width: itemRect.width,
        };
      })
      .filter((item) => item.width > 0 && item.height > 0)
      .sort((a, b) => a.top - b.top);

    formItems.forEach((itemRect) => {
      const row = rows.find(
        (item) =>
          itemRect.top < item.bottom - 1 && itemRect.bottom > item.top + 1,
      );

      if (row) {
        row.top = Math.min(row.top, itemRect.top);
        row.bottom = Math.max(row.bottom, itemRect.bottom);
        row.count += 1;
      } else {
        rows.push({
          bottom: itemRect.bottom,
          count: 1,
          top: itemRect.top,
        });
      }
    });

    rows
      .sort((a, b) => a.top - b.top)
      .slice(0, props.collapsedRows ?? 1)
      .forEach((row, index) => {
        rowMapping.value[index + 1] = row.count;
      });
    isCalculated.value = rows.length > 0;
  }

  onMounted(() => {
    calculateRowMapping();
  });

  return { isCalculated, keepFormItemIndex, wrapperRef };
}
