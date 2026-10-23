import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemRoleApi } from '#/api/system/role';

import { CommonStatusEnum, DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';

import { z } from '#/adapter/form';
import { getRangePickerDefaultProps } from '#/utils';

/** Create/update role form. */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    {
      fieldName: 'name',
      label: '角色名称',
      component: 'Input',
      componentProps: {
        allowClear: true,
        maxlength: 30,
        placeholder: '请输入角色名称',
      },
      rules: 'required',
    },
    {
      fieldName: 'status',
      label: '角色状态',
      component: 'RadioGroup',
      componentProps: {
        options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
        buttonStyle: 'solid',
        optionType: 'button',
      },
      defaultValue: CommonStatusEnum.ENABLE,
      rules: z.number().default(CommonStatusEnum.ENABLE),
    },
    {
      fieldName: 'remark',
      label: '角色备注',
      component: 'Textarea',
      componentProps: {
        maxlength: 500,
        placeholder: '请输入角色备注',
        rows: 3,
      },
      formItemClass: 'col-span-1 sm:col-span-2',
    },
  ];
}

/** 分配菜单的表单 */
export function useAssignMenuFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    {
      fieldName: 'name',
      label: '角色名称',
      component: 'Input',
      componentProps: {
        disabled: true,
      },
    },
    {
      fieldName: 'menuIds',
      label: '菜单权限',
      component: 'Input',
      formItemClass: 'items-start',
    },
  ];
}

/** 列表的搜索表单 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'name',
      label: '角色名称',
      component: 'Input',
      componentProps: {
        placeholder: '请输入角色名称',
        allowClear: true,
      },
    },
    {
      fieldName: 'status',
      label: '角色状态',
      component: 'Select',
      componentProps: {
        options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
        placeholder: '请选择角色状态',
        allowClear: true,
        popupClassName: 'role-management-search-select-dropdown',
      },
    },
    {
      fieldName: 'createTime',
      label: '创建时间',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
  ];
}

/** 列表的字段 */
export function useGridColumns(): VxeTableGridOptions<SystemRoleApi.Role>['columns'] {
  return [
    {
      type: 'checkbox',
      width: 40,
      resizable: false,
      params: { systemColumn: true },
    },
    {
      field: 'id',
      title: '角色编号',
      width: 100,
      align: 'center',
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'name',
      title: '角色名称',
      minWidth: 180,
      align: 'left',
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'type',
      title: '角色类型',
      width: 100,
      align: 'center',
      sortable: true,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.SYSTEM_ROLE_TYPE },
      },
    },
    {
      field: 'remark',
      title: '角色备注',
      minWidth: 220,
      align: 'left',
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'status',
      title: '角色状态',
      width: 100,
      align: 'center',
      sortable: true,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.COMMON_STATUS },
      },
    },
    {
      field: 'createTime',
      title: '创建时间',
      width: 180,
      align: 'center',
      sortable: true,
      formatter: 'formatDateTime',
      showOverflow: 'tooltip',
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      resizable: false,
      params: { systemColumn: true },
      slots: { default: 'actions' },
    },
  ];
}
