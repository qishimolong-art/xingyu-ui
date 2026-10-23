import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  compile,
  createApp,
  defineComponent,
  h,
  nextTick,
  reactive,
} from 'vue';

import { describe, expect, it } from 'vitest';

const saleDir = join(process.cwd(), 'apps/web-antd/src/views/erp/sale');

// Render the real cell templates so conditional branches are exercised, rather
// than only asserting that a readonly string appears somewhere in the source.
function mountLocationCells(module: string, disabled: boolean) {
  const source = readFileSync(
    join(saleDir, module, 'modules/item-form.vue'),
    'utf8',
  );
  const cells = ['warehouseId', 'deptId'].map((field) => {
    const slot = source.match(
      new RegExp(`<template #${field}="\\{ row \\}">([\\s\\S]*?)</template>`),
    );
    if (!slot) throw new Error(`Missing ${module}/${field} cell`);
    return `<div data-field="${field}">${slot[1]}</div>`;
  });
  const state = reactive({
    disabled,
    stockLocationReadonly: true,
    warehouseReadonly: false,
    props: { mainDeptId: 1 },
    row: {
      deptId: 1,
      deptName: '销售部门',
      warehouseId: 2,
      warehouseName: '库存仓库',
    },
    getReadonlyWarehouseName: (row: any) => row.warehouseName || '-',
    getCurrentDeptDisplayName: (row: any) => row.deptName || '-',
    getDeptDisplayName: () => '销售部门',
    getWarehouseOptions: () => [],
    getCurrentDeptOption: () => [],
    getAllSaleProductWarehouseParams: () => ({}),
    getSaleWarehouseSimplePage: async () => ({ list: [], total: 0 }),
    loadItemDeptSimplePage: async () => ({ list: [], total: 0 }),
    handleWarehouseChange: () => {},
    handleDeptChange: () => {},
    handleWarehouseOptionsChange: () => {},
    handleDeptOptionsChange: () => {},
  });
  const container = document.createElement('div');
  const app = createApp(
    defineComponent({
      components: {
        ErpLazyPageSelect: defineComponent({
          render: () => h('button', 'location picker'),
        }),
      },
      setup: () => state,
      render: compile(`<div>${cells.join('')}</div>`),
    }),
  );
  app.mount(container);
  return { app, container, state };
}

describe('stock-selected sale location cells', () => {
  it.each(['cart', 'quote', 'order', 'return'])(
    '%s stays readonly after row reload and detail switch',
    async (module) => {
      const { app, container, state } = mountLocationCells(module, false);
      try {
        expect(container.textContent).toContain('库存仓库');
        expect(container.textContent).toContain('销售部门');
        expect(container.querySelector('button,input,select')).toBeNull();
        state.row = { ...state.row, warehouseId: 3, warehouseName: '重选仓库' };
        await nextTick();
        expect(container.textContent).toContain('重选仓库');
        expect(container.querySelector('button,input,select')).toBeNull();
        state.disabled = true;
        await nextTick();
        expect(container.querySelector('button,input,select')).toBeNull();
      } finally {
        app.unmount();
      }
    },
  );

  it('retains source-document return editors only outside stock-return mode', async () => {
    const { app, container, state } = mountLocationCells('return', false);
    try {
      state.stockLocationReadonly = false;
      await nextTick();
      expect(container.querySelectorAll('button')).toHaveLength(2);
      state.stockLocationReadonly = true;
      await nextTick();
      expect(container.querySelectorAll('button')).toHaveLength(0);
    } finally {
      app.unmount();
    }
  });
});
