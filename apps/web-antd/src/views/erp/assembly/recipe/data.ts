import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpAssemblyRecipeApi } from '#/api/erp/assembly/recipe';

export const recipeStatusOptions = [
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'keyword',
      label: '关键词',
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '模块编码/名称/组成件编码/名称/厂家编码',
      },
    },
    {
      fieldName: 'status',
      label: '状态',
      component: 'Select',
      componentProps: { allowClear: true, options: recipeStatusOptions },
    },
  ];
}

export function useGridColumns(): VxeTableGridOptions<ErpAssemblyRecipeApi.Recipe>['columns'] {
  return [
    { type: 'checkbox', width: 50, autoFixed: false } as any,
    {
      title: '操作',
      width: 70,
      autoFixed: false,
      slots: { default: 'actions' },
    } as any,
    {
      field: 'moduleCode',
      title: '模块编码',
      width: 150,
      slots: { default: 'moduleCode' },
    },
    { field: 'moduleName', title: '模块名称', minWidth: 180 },
    { field: 'productName', title: '组成件', minWidth: 180 },
    { field: 'productDrawingNo', title: '图号', minWidth: 120 },
    { field: 'productStandard', title: '规格', minWidth: 120 },
    { field: 'productCode', title: '组成件编码', width: 140 },
    { field: 'productFeatureCode', title: '特征码', minWidth: 110 },
    { field: 'productOriginPlace', title: '产地', minWidth: 110 },
    { field: 'productVehicleModel', title: '适用车型', minWidth: 140 },
    {
      field: 'productReferencePrice',
      title: '参考价',
      width: 100,
      formatter: 'formatAmount2',
    },
    {
      field: 'purpose',
      title: '类型',
      width: 80,
      slots: { default: 'purpose' },
    },
    {
      field: 'createTime',
      title: '创建日期',
      width: 170,
      formatter: 'formatDateTime',
    },
    { field: 'status', title: '状态', width: 90, slots: { default: 'status' } },
  ];
}
