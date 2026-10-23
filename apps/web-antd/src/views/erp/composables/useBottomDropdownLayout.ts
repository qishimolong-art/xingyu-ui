import type { Ref } from 'vue';

import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';

const GAP = 4;
const EDGE = 8;

/** Keep the footer outside the shrinking, independently scrollable table. */
export function getBottomDropdownSpace(
  anchorBottom: number,
  boundaryBottom: number,
  tableHeight: number,
  footerHeight: number,
) {
  const available = Math.max(0, boundaryBottom - anchorBottom - GAP - EDGE);
  return {
    missing: Math.max(0, tableHeight + footerHeight - available),
    tableMaxHeight: Math.max(
      0,
      Math.min(tableHeight, available - footerHeight),
    ),
  };
}

interface BottomDropdownOptions {
  anchor: () => HTMLElement | undefined;
  contentVersion: () => unknown;
  footer: Ref<HTMLElement | undefined>;
  loading: () => boolean;
  maxTableHeight?: number;
  open: () => boolean;
  reservedTableHeight: number;
  table: Ref<HTMLElement | undefined>;
}

/** Opt-in layout for inline pickers. No business data or global styles. */
export function useBottomDropdownLayout(options: BottomDropdownOptions) {
  const tableMaxHeight = ref(
    Math.min(
      options.reservedTableHeight,
      options.maxTableHeight ?? Number.POSITIVE_INFINITY,
    ),
  );
  const align = shallowRef({ offset: [0, GAP] });
  let frame: number | undefined;
  let shouldMakeRoom = false;
  let observer: ResizeObserver | undefined;
  let spacer: HTMLElement | undefined;
  let lastGeometry = '';
  let listening = false;
  let disposed = false;

  function scrollParents(anchor: HTMLElement) {
    const parents: HTMLElement[] = [];
    const dialog = anchor.closest('[role="dialog"]');
    for (
      let parent = anchor.parentElement;
      parent && parent !== dialog && parent !== document.body;
      parent = parent.parentElement
    ) {
      if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) {
        parents.push(parent);
      }
    }
    return parents;
  }

  function updateLayout(makeRoom: boolean) {
    const anchor = options.anchor();
    const table = options.table.value;
    const footer = options.footer.value;
    if (!options.open() || !anchor?.isConnected || !table || !footer) return;

    const parents = scrollParents(anchor);
    // Prefer the form viewport over the inner grid: don't scroll the input
    // under a sticky grid header merely to make the popup taller.
    const formViewport = parents.at(-1);
    const dialog = anchor.closest('[role="dialog"]');
    const viewport = window.visualViewport;
    const viewportBottom = viewport
      ? viewport.offsetTop + viewport.height
      : window.innerHeight;
    const boundaryBottom = Math.min(
      viewportBottom,
      dialog?.getBoundingClientRect().bottom ?? viewportBottom,
      formViewport?.getBoundingClientRect().bottom ?? viewportBottom,
    );
    const footerHeight = footer.offsetHeight;
    const naturalTableHeight =
      table.scrollHeight + table.offsetHeight - table.clientHeight;
    const naturalOrReservedTableHeight = options.loading()
      ? Math.max(options.reservedTableHeight, naturalTableHeight)
      : naturalTableHeight;
    const tableHeight = Math.min(
      naturalOrReservedTableHeight,
      options.maxTableHeight ?? Number.POSITIVE_INFINITY,
    );

    if (makeRoom && formViewport) {
      const rect = anchor.getBoundingClientRect();
      const { missing } = getBottomDropdownSpace(
        rect.bottom,
        boundaryBottom,
        tableHeight,
        footerHeight,
      );
      const top = Math.max(
        viewport?.offsetTop ?? 0,
        formViewport.getBoundingClientRect().top,
      );
      const distance = Math.min(missing, Math.max(0, rect.top - top - EDGE));
      if (distance > 0) {
        const remaining =
          formViewport.scrollHeight -
          formViewport.clientHeight -
          formViewport.scrollTop;
        // Short forms may have no spare scroll range. Reserve only the missing
        // space, locally and temporarily, so their last input can also move up.
        if (remaining < distance) {
          if (!spacer) {
            spacer = document.createElement('div');
            spacer.setAttribute('aria-hidden', 'true');
            spacer.style.cssText =
              'flex-shrink:0;pointer-events:none;overflow-anchor:none;';
            formViewport.append(spacer);
          }
          spacer.style.height = `${spacer.offsetHeight + distance - Math.max(0, remaining)}px`;
        }
        formViewport.scrollTop += distance;
      }
    }

    const rect = anchor.getBoundingClientRect();
    tableMaxHeight.value = getBottomDropdownSpace(
      rect.bottom,
      boundaryBottom,
      tableHeight,
      footerHeight,
    ).tableMaxHeight;
    const geometry = [
      rect.top,
      rect.left,
      rect.bottom,
      rect.width,
      tableMaxHeight.value,
      footerHeight,
    ].join(',');
    if (geometry !== lastGeometry) {
      lastGeometry = geometry;
      // Popover forwards align to vc-trigger; a new align prop requests a fresh
      // measurement after a nested form scroll (without private component APIs).
      align.value = { offset: [0, GAP] };
    }
  }

  function schedule(makeRoom = false) {
    if (disposed || !options.open()) return;
    shouldMakeRoom ||= makeRoom;
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      const makeRoomNow = shouldMakeRoom;
      shouldMakeRoom = false;
      updateLayout(makeRoomNow);
    });
  }

  function onScroll() {
    schedule();
  }
  function onResize() {
    schedule(true);
  }

  function cleanup() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    shouldMakeRoom = false;
    observer?.disconnect();
    observer = undefined;
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onResize);
    window.visualViewport?.removeEventListener('resize', onResize);
    window.visualViewport?.removeEventListener('scroll', onScroll);
    spacer?.remove();
    spacer = undefined;
    listening = false;
    lastGeometry = '';
  }

  watch(
    [options.open, options.table, options.footer],
    async () => {
      if (!options.open()) {
        cleanup();
        return;
      }
      await nextTick();
      if (
        disposed ||
        !options.open() ||
        !options.table.value ||
        !options.footer.value
      )
        return;
      if (!listening) {
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('scroll', onScroll);
        listening = true;
        // Measure natural content, not the constrained wrapper. Popover may
        // mount hidden before its enter transition; make room once its table
        // and footer acquire their real size, without a resize feedback loop.
        observer = new ResizeObserver(() => schedule(true));
        observer.observe(
          options.table.value.firstElementChild ?? options.table.value,
        );
        observer.observe(options.footer.value);
      }
      schedule(true);
    },
    { flush: 'post' },
  );
  watch([options.contentVersion, options.loading], () => schedule(true), {
    flush: 'post',
  });
  onBeforeUnmount(() => {
    disposed = true;
    cleanup();
  });

  return { align, tableMaxHeight };
}
