import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemDeptApi } from '#/api/system/dept';
import type { SystemUserApi } from '#/api/system/user';

import { CommonStatusEnum, DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';
import { handleTree } from '@vben/utils';

import { z } from '#/adapter/form';
import { getDeptList } from '#/api/system/dept';
import { getSimpleUserList } from '#/api/system/user';
import {
  applyFieldPermission,
  isFieldHidden,
} from '#/composables/useFieldPermission';

/** 关联数据 */
let userList: SystemUserApi.User[] = [];
getSimpleUserList().then((data) => (userList = data));

/** 新增/修改的表单 */
export function useFormSchema(hiddenFields: string[] = []): VbenFormSchema[] {
  return applyFieldPermission(
    [
      {
        fieldName: 'id',
        component: 'Input',
        dependencies: {
          triggerFields: [''],
          show: () => false,
        },
      },
      {
        fieldName: 'parentId',
        label: '上级部门',
        component: 'ApiTreeSelect',
        componentProps: {
          allowClear: true,
          api: async () => {
            const data = await getDeptList();
            data.unshift({
              id: 0,
              name: '顶级部门',
            });
            return handleTree(data);
          },
          labelField: 'name',
          valueField: 'id',
          childrenField: 'children',
          placeholder: '请选择上级部门',
          popupClassName: 'department-form-select-dropdown',
          treeDefaultExpandAll: true,
        },
        rules: 'selectRequired',
      },
      {
        fieldName: 'name',
        label: '部门名称',
        component: 'Input',
        componentProps: {
          placeholder: '请输入部门名称',
        },
        rules: 'required',
      },
      {
        fieldName: 'sort',
        label: '显示顺序',
        component: 'InputNumber',
        componentProps: {
          min: 0,
          placeholder: '请输入显示顺序',
        },
        rules: z.number().nullable().optional(),
      },
      {
        fieldName: 'leaderUserId',
        label: '负责人',
        component: 'ApiSelect',
        componentProps: {
          api: getSimpleUserList,
          labelField: 'nickname',
          valueField: 'id',
          placeholder: '请选择负责人',
          popupClassName: 'department-form-select-dropdown',
          allowClear: true,
        },
        rules: z.number().nullable().optional(),
      },
      {
        fieldName: 'phone',
        label: '联系电话',
        component: 'Input',
        componentProps: {
          maxLength: 30,
          placeholder: '请输入手机号、座机或 400 电话',
        },
        rules: z
          .string()
          .max(30, '联系电话长度不能超过 30 个字符')
          .nullable()
          .optional(),
      },
      {
        fieldName: 'address',
        label: '详细地址',
        component: 'Input',
        componentProps: {
          maxLength: 255,
          placeholder: '请输入详细地址',
        },
        formItemClass: 'col-span-2',
        rules: z
          .string()
          .max(255, '详细地址长度不能超过 255 个字符')
          .nullable()
          .optional(),
      },
      {
        fieldName: 'mapName',
        label: '地图名称',
        component: 'Input',
        componentProps: {
          maxLength: 100,
          placeholder: '请输入地图展示名称',
        },
        rules: z
          .string()
          .max(100, '地图显示名称长度不能超过 100 个字符')
          .nullable()
          .optional(),
      },
      {
        fieldName: 'longitude',
        label: '经度',
        component: 'InputNumber',
        componentProps: {
          max: 180,
          min: -180,
          precision: 6,
          placeholder: '请输入经度',
        },
        rules: z
          .number()
          .max(180, '经度不能大于 180')
          .min(-180, '经度不能小于 -180')
          .nullable()
          .optional(),
      },
      {
        fieldName: 'latitude',
        label: '纬度',
        component: 'InputNumber',
        componentProps: {
          max: 90,
          min: -90,
          precision: 6,
          placeholder: '请输入纬度',
        },
        rules: z
          .number()
          .max(90, '纬度不能大于 90')
          .min(-90, '纬度不能小于 -90')
          .nullable()
          .optional(),
      },
      {
        fieldName: 'email',
        label: '邮箱',
        component: 'Input',
        componentProps: {
          placeholder: '请输入邮箱',
        },
        rules: z.string().email('邮箱格式不正确').or(z.literal('')).optional(),
      },
      {
        fieldName: 'status',
        label: '状态',
        component: 'RadioGroup',
        componentProps: {
          options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
          buttonStyle: 'solid',
          optionType: 'button',
        },
        rules: z.number().default(CommonStatusEnum.ENABLE),
      },
    ],
    hiddenFields,
  ).filter((schema) => schema.fieldName !== 'email');
}

/** 列表的字段 */
export function useGridFormSchema(
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  const searchHiddenFields = hiddenFields.flatMap((field) => {
    const normalizedField = field.startsWith('search_')
      ? field.slice(7)
      : field;
    return normalizedField === 'leaderUserId'
      ? [normalizedField, 'leaderUserName']
      : [normalizedField];
  });
  return applyFieldPermission(
    [
      {
        fieldName: 'name',
        label: '部门名称',
        component: 'Input',
        componentProps: {
          placeholder: '请输入部门名称',
          allowClear: true,
        },
      },
      {
        fieldName: 'leaderUserName',
        label: '负责人',
        component: 'Input',
        componentProps: {
          placeholder: '请输入负责人',
          allowClear: true,
        },
      },
      {
        fieldName: 'status',
        label: '部门状态',
        component: 'Select',
        componentProps: {
          options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
          placeholder: '请选择部门状态',
          allowClear: true,
          popupClassName: 'department-search-select-dropdown',
        },
      },
    ],
    searchHiddenFields,
  );
}

export function useGridColumns(
  hiddenFields: string[] = [],
): VxeTableGridOptions<SystemDeptApi.Dept>['columns'] {
  const columns: VxeTableGridOptions<SystemDeptApi.Dept>['columns'] = [
    {
      type: 'checkbox',
      width: 40,
      fixed: 'left',
      resizable: false,
      params: { systemColumn: true },
    },
    {
      title: '',
      width: 48,
      align: 'center',
      fixed: 'left',
      resizable: false,
      params: { systemColumn: true },
      slots: { default: 'dragHandle' },
    },
    {
      field: 'id',
      title: '部门编码',
      width: 120,
      fixed: 'left',
      sortable: true,
    },
    {
      field: 'name',
      title: '部门名称',
      minWidth: 150,
      align: 'left',
      fixed: 'left',
      params: { systemColumn: true },
      sortable: true,
      treeNode: true,
    },
    {
      field: 'leaderUserId',
      title: '负责人',
      minWidth: 150,
      sortable: true,
      formatter: ({ cellValue }: { cellValue: number }) =>
        userList.find((user) => user.id === cellValue)?.nickname || '-',
    },
    {
      field: 'phone',
      title: '联系电话',
      minWidth: 140,
      formatter: ({ cellValue }: { cellValue?: string }) => cellValue || '-',
    },
    {
      field: 'address',
      title: '详细地址',
      minWidth: 220,
      formatter: ({ cellValue }: { cellValue?: string }) => cellValue || '-',
    },
    {
      field: 'navigationConfigured',
      title: '导航配置',
      minWidth: 110,
      formatter: ({ row }: { row: SystemDeptApi.Dept }) =>
        row.longitude !== null &&
        row.longitude !== undefined &&
        row.latitude !== null &&
        row.latitude !== undefined
          ? '已配置'
          : '未配置',
    },
    {
      field: 'sort',
      title: '显示顺序',
      minWidth: 100,
      sortable: true,
    },
    {
      field: 'status',
      title: '部门状态',
      minWidth: 100,
      sortable: true,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.COMMON_STATUS },
      },
    },
    {
      field: 'createTime',
      title: '创建时间',
      minWidth: 180,
      sortable: true,
      formatter: 'formatDateTime',
    },
    {
      title: '操作',
      width: 220,
      fixed: 'right',
      resizable: false,
      params: { systemColumn: true },
      slots: { default: 'actions' },
    },
  ];
  return columns?.filter((column: any) => {
    if (!column.field) {
      return true;
    }
    if (column.field === 'navigationConfigured') {
      return !(
        isFieldHidden(hiddenFields, 'longitude') ||
        isFieldHidden(hiddenFields, 'latitude')
      );
    }
    return !isFieldHidden(hiddenFields, column.field);
  });
}
