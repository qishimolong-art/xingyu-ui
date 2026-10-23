import { describe, expect, it } from 'vitest';

import {
  applyFinanceDocumentItemColumnCustomization,
  prepareFinanceDocumentItemColumns,
} from './document-item-table';
import {
  applyFinanceDocumentListColumnCustomization,
  prepareFinanceDocumentListColumns,
} from './document-list-table';

describe('finance document adaptive column width', () => {
  it('keeps short document numbers compact and expands long document numbers', () => {
    const shortColumns = prepareFinanceDocumentListColumns(
      [{ field: 'no', title: '单号', width: 180 }],
      [{ no: 'FK1' }],
    );
    const longColumns = prepareFinanceDocumentListColumns(
      [{ field: 'no', title: '单号', width: 90 }],
      [{ no: 'FK2026092200000000000001' }],
    );

    expect(shortColumns[0]?.width).toBeLessThan(180);
    expect(longColumns[0]?.width).toBeGreaterThan(180);
  });

  it('fully measures normal settlement numbers and company names from the current page', () => {
    const columns = prepareFinanceDocumentListColumns(
      [
        { field: 'no', title: '单号', width: 118, sortable: true },
        {
          field: 'supplierName',
          title: '供应商',
          width: 132,
          sortable: true,
        },
      ],
      [
        {
          no: 'FKD20261019000001',
          supplierName: '埃克森美孚（中国）投资有限公司',
        },
      ],
    );

    expect(
      columns.find((column) => column.field === 'no')?.width,
    ).toBeGreaterThan(118);
    expect(
      columns.find((column) => column.field === 'supplierName')?.width,
    ).toBeGreaterThan(132);
  });

  it('reserves full date time width but keeps date columns narrower', () => {
    const columns = prepareFinanceDocumentListColumns(
      [
        { field: 'bizTime', title: '日期', width: 80, formatter: 'formatDate' },
        {
          field: 'auditTime',
          title: '审核时间',
          width: 80,
          formatter: 'formatDateTime',
        },
      ],
      [
        {
          auditTime: '2026-09-22 13:45:59',
          bizTime: '2026-09-22',
        },
      ],
    );

    expect(
      columns.find((column) => column.field === 'auditTime')?.width,
    ).toBeGreaterThan(
      columns.find((column) => column.field === 'bizTime')?.width as number,
    );
  });

  it('keeps amount and status columns compact', () => {
    const columns = prepareFinanceDocumentListColumns(
      [
        {
          field: 'totalAmount',
          title: '金额',
          width: 160,
          formatter: 'formatAmount2',
        },
        { field: 'status', title: '状态', width: 120 },
      ],
      [{ status: '已审核', totalAmount: 12.3 }],
    );

    expect(
      columns.find((column) => column.field === 'totalAmount')?.width,
    ).toBeLessThan(120);
    expect(
      columns.find((column) => column.field === 'status')?.width,
    ).toBeLessThan(100);
  });

  it('makes only the trailing finance list data column flexible when requested', () => {
    const columns = prepareFinanceDocumentListColumns(
      [
        { type: 'checkbox', width: 36 },
        { field: 'printAction', title: '打印', width: 40 },
        { field: 'remark', title: '备注', width: 160 },
        { field: 'auditorName', title: '审核人', width: 100 },
        {
          field: 'actions',
          title: '操作',
          width: 168,
          fixed: 'right',
        },
      ],
      [{ auditorName: '数创公司' }],
      { trailingFlexibleColumnMinWidth: 72 },
    ) as any[];

    expect(columns[2]).toHaveProperty('width');
    expect(columns[3]).not.toHaveProperty('width');
    expect(columns[3]?.minWidth).toBeGreaterThanOrEqual(72);
    expect(columns[4]?.fixed).toBe('right');
  });

  it('reselects the finance list adaptive column after column settings changes', () => {
    const preparedColumns = prepareFinanceDocumentListColumns(
      [
        { field: 'remark', title: '备注', width: 160 },
        { field: 'auditorName', title: '审核人', width: 100 },
        {
          field: 'actions',
          title: '操作',
          width: 168,
          fixed: 'right',
        },
      ],
      [],
      { trailingFlexibleColumnMinWidth: 72 },
    );
    const columns = applyFinanceDocumentListColumnCustomization(
      preparedColumns,
      [
        { field: 'auditorName', renderVisible: false },
        { field: 'remark', renderVisible: true, resizeWidth: 220 },
        { field: 'actions', renderFixed: null, resizeWidth: 260 },
      ],
      72,
    ) as any[];

    expect(columns.map((column) => column.field)).toEqual([
      'auditorName',
      'remark',
      'actions',
    ]);
    expect(columns[0]?.visible).toBe(false);
    expect(columns[1]).not.toHaveProperty('width');
    expect(columns[1]?.minWidth).toBe(220);
    expect(columns[2]?.fixed).toBe('right');
    expect(columns[2]?.width).toBe(168);
  });

  it('reserves select control width in edit mode and shrinks in detail mode', () => {
    const editColumns = prepareFinanceDocumentItemColumns(
      [{ field: 'deptId', title: '部门', minWidth: 80 }],
      {
        editable: true,
        rows: [{ deptId: 1, deptName: '兴宁路通' }],
      },
    );
    const detailColumns = prepareFinanceDocumentItemColumns(
      [{ field: 'deptId', title: '部门', minWidth: 80 }],
      {
        editable: false,
        rows: [{ deptId: 1, deptName: '兴宁路通' }],
      },
    );

    expect((editColumns[0] as any)?.width).toBeGreaterThan(
      (detailColumns[0] as any)?.width as number,
    );
    expect(editColumns[0]).not.toHaveProperty('minWidth');
  });

  it('keeps selection and action columns fixed', () => {
    const columns = prepareFinanceDocumentItemColumns(
      [
        { type: 'checkbox', width: 36 },
        {
          field: 'actions',
          title: '操作',
          width: 72,
          slots: { default: 'actions' },
        },
      ],
      { rows: [{ actions: '删除' }] },
    );

    expect(columns[0]?.width).toBe(36);
    expect((columns[1] as any)?.fixed).toBe('right');
    expect((columns[1] as any)?.sortable).toBe(false);
  });

  it('makes only the trailing visible business column flexible when requested', () => {
    const columns = prepareFinanceDocumentItemColumns(
      [
        { field: 'remark', title: '备注', width: 180 },
        { field: 'fileUrl', title: '附件', width: 96 },
        {
          field: 'actions',
          title: '操作',
          width: 72,
          slots: { default: 'actions' },
        },
      ],
      { trailingFlexibleColumnMinWidth: 150 },
    ) as any[];

    expect(columns[0]).toHaveProperty('width');
    expect(columns[1]).not.toHaveProperty('width');
    expect(columns[1]?.minWidth).toBe(150);
    expect(columns[2]?.fixed).toBe('right');
    expect(columns[2]).not.toHaveProperty('minWidth');
  });

  it('reselects the adaptive column after column settings hide or reorder fields', () => {
    const preparedColumns = prepareFinanceDocumentItemColumns(
      [
        { field: 'remark', title: '备注', width: 180 },
        { field: 'fileUrl', title: '附件', width: 96 },
        { field: 'actions', title: '操作', visible: false, width: 72 },
      ],
      { trailingFlexibleColumnMinWidth: 150 },
    );
    const columns = applyFinanceDocumentItemColumnCustomization(
      preparedColumns,
      [
        { field: 'fileUrl', renderVisible: false },
        { field: 'remark', renderVisible: true, resizeWidth: 220 },
        { field: 'actions', renderVisible: true },
      ],
      150,
    ) as any[];

    expect(columns.map((column) => column.field)).toEqual([
      'fileUrl',
      'remark',
      'actions',
    ]);
    expect(columns[0]?.visible).toBe(false);
    expect(columns[1]).not.toHaveProperty('width');
    expect(columns[1]?.minWidth).toBe(220);
    expect(columns[2]?.fixed).toBe('right');
    expect(columns[2]?.visible).toBe(false);
  });

  it('restores operation-column visibility when switching from detail to edit', () => {
    const preparedColumns = prepareFinanceDocumentItemColumns(
      [
        { field: 'remark', title: '备注', width: 180 },
        {
          field: 'actions',
          slots: { default: 'actions' },
          title: '操作',
          visible: true,
          width: 72,
        },
      ],
      { trailingFlexibleColumnMinWidth: 150 },
    );
    const columns = applyFinanceDocumentItemColumnCustomization(
      preparedColumns,
      [
        { field: 'remark', renderVisible: true },
        { field: 'actions', renderVisible: false },
      ],
      150,
    ) as any[];

    expect(columns[1]?.visible).toBe(true);
    expect(columns[1]?.fixed).toBe('right');
  });
});
