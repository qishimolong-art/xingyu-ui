import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import type { ErpRecycleBinApi } from '#/api/erp/base/recycle-bin';

import { prepareErpArchiveListColumns } from '#/views/erp/base/utils/archive-list-table';

export const recycleBinSourceOptions = [
  { label: '供应商', value: 'supplier' },
  { label: '客户', value: 'customer' },
  { label: '配件信息', value: 'product' },
  { label: '仓库信息', value: 'warehouse' },
];

export function formatSourceType(
  sourceType?: ErpRecycleBinApi.SourceType | string,
) {
  const match = recycleBinSourceOptions.find(
    (item) => item.value === sourceType,
  );
  return match?.label || '-';
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'sourceType',
      label: '来源',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: recycleBinSourceOptions,
        placeholder: '请选择来源',
      },
    },
    {
      fieldName: 'name',
      label: '名称',
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '请输入名称',
        'data-erp-archive-name-search-input': 'true',
      },
    },
    {
      fieldName: 'code',
      label: '编码',
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '请输入编码',
        'data-erp-archive-code-search-input': 'true',
      },
    },
  ];
}

export function useGridColumns(
  rows: ErpRecycleBinApi.RecycleBinItem[] = [],
): VxeTableGridOptions['columns'] {
  return prepareErpArchiveListColumns(
    [
      {
        type: 'checkbox',
        width: 50,
        fixed: 'left',
      },
      {
        field: 'code',
        title: '编码',
        minWidth: 150,
        showOverflow: 'tooltip',
      },
      {
        field: 'name',
        title: '名称',
        minWidth: 180,
        showOverflow: 'tooltip',
      },
      {
        field: 'sourceType',
        title: '类型',
        minWidth: 110,
        formatter: ({ cellValue }) => formatSourceType(cellValue),
      },
      {
        field: 'disabledByName',
        title: '停用者',
        minWidth: 120,
        formatter: ({ cellValue }) => cellValue || '-',
      },
      {
        field: 'disabledTime',
        title: '停用时间',
        minWidth: 170,
        formatter: 'formatDateTime',
      },
    ],
    rows,
  );
}
