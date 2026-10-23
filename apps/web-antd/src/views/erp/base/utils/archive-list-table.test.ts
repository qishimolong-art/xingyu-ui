import { describe, expect, it } from 'vitest';

import {
  prepareErpArchiveItemColumns,
  prepareErpArchiveListColumns,
} from './archive-list-table';

describe('erp archive adaptive table widths', () => {
  it('keeps short archive fields compact and expands long text from current page rows', () => {
    const columns = prepareErpArchiveListColumns(
      [
        { type: 'checkbox', width: 40 },
        { field: 'code', title: '编码', minWidth: 150, sortable: true },
        { field: 'name', title: '名称', minWidth: 180, sortable: true },
        { field: 'remark', title: '备注', minWidth: 220 },
        { field: 'status', title: '状态', minWidth: 100 },
        {
          title: '操作',
          width: 130,
          fixed: 'right',
          slots: { default: 'actions' },
        },
      ] as any[],
      [
        {
          code: 'P001',
          name: '短名称',
          remark: '这是一段明显更长的基础档案备注信息',
          status: '启用',
        },
      ],
    ) as any[];

    expect(
      columns.find((column) => column.field === 'code')?.width,
    ).toBeLessThan(150);
    expect(
      columns.find((column) => column.field === 'name')?.width,
    ).toBeLessThan(180);
    expect(
      columns.find((column) => column.field === 'remark')?.width,
    ).toBeGreaterThan(220);
    expect(columns.at(0)?.width).toBe(40);
    expect(columns.at(-1)).toMatchObject({ fixed: 'right', width: 130 });
  });

  it('reserves full datetime width but keeps date and number-like fields tight', () => {
    const columns = prepareErpArchiveListColumns(
      [
        {
          field: 'createTime',
          title: '创建时间',
          minWidth: 112,
          formatter: 'formatDateTime',
        },
        {
          field: 'contractDate',
          title: '合同日期',
          minWidth: 170,
          formatter: 'formatDate',
        },
        { field: 'sort', title: '排序', minWidth: 90 },
      ] as any[],
      [
        {
          createTime: '2026-09-22 10:11:12',
          contractDate: '2026-09-22',
          sort: 1,
        },
      ],
    ) as any[];

    expect(
      columns.find((column) => column.field === 'createTime')?.width,
    ).toBeGreaterThanOrEqual(160);
    expect(
      columns.find((column) => column.field === 'contractDate')?.width,
    ).toBeLessThan(170);
    expect(
      columns.find((column) => column.field === 'sort')?.width,
    ).toBeLessThan(90);
  });

  it('lets archive detail tables remove ellipsis and reserve edit control room', () => {
    const columns = prepareErpArchiveItemColumns(
      [
        { title: '部门', dataIndex: 'deptId', width: 80, ellipsis: true },
        { title: '备注', dataIndex: 'remark', width: 120, ellipsis: true },
        { title: '操作', dataIndex: 'actions', width: 80, fixed: 'right' },
      ],
      {
        editable: true,
        rows: [{ deptName: '兴宇路通', remark: '明细表里一段比较长的备注' }],
      },
    ) as any[];

    const deptColumn = columns.find((column) => column.dataIndex === 'deptId');
    const remarkColumn = columns.find(
      (column) => column.dataIndex === 'remark',
    );

    expect(deptColumn?.ellipsis).toBeUndefined();
    expect(deptColumn?.width).toBeGreaterThan(80);
    expect(remarkColumn?.ellipsis).toBeUndefined();
    expect(remarkColumn?.width).toBeGreaterThan(120);
    expect(columns.at(-1)).toMatchObject({ fixed: 'right', width: 80 });
  });
});
