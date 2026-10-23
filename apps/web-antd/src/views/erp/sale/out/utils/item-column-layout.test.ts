import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { createApp, h, nextTick } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { restoreSaleOutItemColumnLayout } from './item-column-layout';

// VXE is a dependency of the shared grid adapter, not of the application.
const { VxeGrid } = createRequire(
  resolve('packages/effects/plugins/package.json'),
)('vxe-table');

function createColumns() {
  return [
    { type: 'seq', width: 50 },
    { field: 'productName', width: 220 },
    { field: 'drawingNo', width: 66 },
    { field: 'remark', minWidth: 150 },
  ].map((column) => ({
    ...column,
    visible: true,
    resizeWidth: 0,
    getKey: () => column.field ?? `type=${column.type}`,
  }));
}

function restore(columns: any[], storeData: any = {}) {
  const restored = restoreSaleOutItemColumnLayout({
    $table: { getFullColumns: () => columns },
    storeData,
  });
  // VXE applies these values after restoreStore and prioritizes resizeWidth.
  columns.forEach((column) => {
    const key = column.getKey();
    column.visible = restored.visibleData?.[key] ?? column.visible;
    column.fixed = restored.fixedData?.[key] ?? column.fixed;
    column.resizeWidth = restored.resizableData?.[key] ?? column.resizeWidth;
  });
  return restored;
}

function allocateWidth(columns: any[], containerWidth: number) {
  const visible = columns.filter((column) => column.visible);
  const width = (column: any) =>
    column.resizeWidth || column.width || column.minWidth || 40;
  const minimum = visible.reduce((sum, column) => sum + width(column), 0);
  const flexible = visible.filter(
    (column) => !column.resizeWidth && !column.width && column.minWidth,
  );
  return (
    minimum + (flexible.length ? Math.max(containerWidth - minimum, 0) : 0)
  );
}

describe('sale-out detail stored column layout', () => {
  it.each([1280, 1920, 2560])(
    'fills %ipx on first mount and reopen when saved settings hide trailing columns',
    (viewport) => {
      const storeData = {
        resizableData: { productName: 300, drawingNo: 80 },
        visibleData: { remark: false },
      };
      const original = structuredClone(storeData);
      for (let cycle = 0; cycle < 2; cycle++) {
        const columns = createColumns();
        restore(columns, storeData);
        expect(columns[1]?.resizeWidth).toBe(300);
        expect(columns[2]).toMatchObject({ minWidth: 150, resizeWidth: 0 });
        expect(columns[2]?.width).toBeUndefined();
        expect(columns[3]?.visible).toBe(false);
        expect(allocateWidth(columns, viewport)).toBe(viewport);
      }
      expect(storeData).toEqual(original);
    },
  );

  it('keeps a wide dragged trailing width as a minimum and preserves horizontal scrolling', () => {
    const columns = createColumns();
    restore(columns, { resizableData: { remark: 1600 } });
    expect(columns[3]).toMatchObject({ minWidth: 1600, resizeWidth: 0 });
    expect(allocateWidth(columns, 1280)).toBe(1936);
    expect(allocateWidth(columns, 2560)).toBe(2560);
  });

  it.each([
    [{ k: 'remark' }, { k: 'drawingNo' }, { k: 'productName' }],
    { remark: 0, drawingNo: 1, productName: 2 },
  ])('respects current and legacy saved column order: %j', (sortData) => {
    const columns = createColumns();
    restore(columns, { sortData });
    expect(columns[1]?.minWidth).toBe(220);
    expect(columns[1]?.width).toBeUndefined();
    expect(columns[3]?.minWidth).toBeUndefined();
    expect(columns[3]?.width).toBe(150);
  });

  it('fills the center without changing frozen or operation widths', () => {
    const columns: any[] = createColumns();
    columns.push({
      field: 'actions',
      fixed: 'right',
      visible: true,
      width: 78,
      getKey: () => 'actions',
    });
    restore(columns, {
      fixedData: { remark: 'right' },
      resizableData: { remark: 250, actions: 90 },
    });
    expect(columns[2]).toMatchObject({ minWidth: 150, resizeWidth: 0 });
    expect(columns[3]).toMatchObject({ fixed: 'right', resizeWidth: 250 });
    expect(columns[4]).toMatchObject({ fixed: 'right', resizeWidth: 90 });
  });

  it('restores defaults without reusing the hidden or reordered runtime layout', () => {
    const columns = createColumns();
    restore(columns);
    expect(columns[3]).toMatchObject({
      visible: true,
      minWidth: 150,
      resizeWidth: 0,
    });
    expect(columns[2]?.width).toBe(66);
    expect(allocateWidth(columns, 1920)).toBe(1920);
  });

  it('never reintroduces permission-filtered columns and handles all-hidden business columns', () => {
    const columns = createColumns().filter(
      (column) => column.field !== 'remark',
    );
    restore(columns, { visibleData: { remark: true } });
    expect(columns.some((column) => column.field === 'remark')).toBe(false);
    expect(columns[2]?.minWidth).toBe(150);
    const storeData = { visibleData: { productName: false, drawingNo: false } };
    expect(restore(columns, storeData)).toBe(storeData);
  });

  it('runs inside actual VXE restore/load ordering, including repeated option reloads', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    let grid: any;
    let adaptive = false;
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(1920);
    const persisted = {
      resizableData: { productName: 300, drawingNo: 80 },
      visibleData: { remark: false },
    };
    const app = createApp({
      render: () =>
        h(VxeGrid, {
          ref: (instance: any) => {
            grid = instance;
          },
          id: 'sale-out-layout-regression-only',
          border: true,
          fit: true,
          columns: [],
          customConfig: {
            storage: {
              fixed: true,
              resizable: true,
              sort: true,
              visible: true,
            },
            restoreStore: (params: any) =>
              adaptive
                ? restoreSaleOutItemColumnLayout({
                    ...params,
                    storeData: persisted,
                  })
                : persisted,
          },
        }),
    });
    try {
      app.mount(container);
      await nextTick();
      await grid.loadColumn(createColumns());
      await grid.recalculate(true);
      const totalRenderedWidth = () =>
        grid
          .getFullColumns()
          .filter((column: any) => column.visible)
          .reduce(
            (total: number, column: any) => total + column.renderWidth,
            0,
          );
      // Without the hook VXE restores a hidden flexible column; fit:true alone
      // cannot grow any of the remaining fixed/resized columns.
      expect(totalRenderedWidth()).toBeLessThan(1920);
      adaptive = true;
      for (let cycle = 0; cycle < 3; cycle++) {
        await grid.loadColumn(
          createColumns().map(({ getKey, ...column }) => {
            void getKey;
            return column;
          }),
        );
        const columns = grid.getFullColumns();
        expect(
          columns.find((column: any) => column.field === 'productName')
            .resizeWidth,
        ).toBe(300);
        expect(
          columns.find((column: any) => column.field === 'remark').visible,
        ).toBe(false);
        expect(
          columns.find((column: any) => column.field === 'drawingNo'),
        ).toMatchObject({
          minWidth: 150,
          resizeWidth: 0,
        });
        await grid.recalculate(true);
        expect(totalRenderedWidth()).toBe(1920);
      }
      expect(persisted.resizableData.drawingNo).toBe(80);
    } finally {
      app.unmount();
      container.remove();
      clientWidth.mockRestore();
    }
  });
});
