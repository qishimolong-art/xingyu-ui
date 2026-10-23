import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemUserApi } from '#/api/system/user';
import type { Recordable } from '@vben/types';

import { CommonStatusEnum, DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';
import { $t } from '@vben/locales';
import { handleTree } from '@vben/utils';

import { z } from '#/adapter/form';
import { getDeptList } from '#/api/system/dept';
import { getSimpleRoleList } from '#/api/system/role';
import {
  applyFieldPermission,
  isFieldHidden,
} from '#/composables/useFieldPermission';
import { getRangePickerDefaultProps } from '#/utils';

type DeptTreeOption = {
  children?: DeptTreeOption[];
  id?: number;
  name?: string;
};

export function formatDeptTreeSelectValues(
  ids: number[],
  departments: DeptTreeOption[],
) {
  const deptNameMap = new Map<number, string>();
  const visit = (items: DeptTreeOption[]) => {
    items.forEach((item) => {
      if (item.id !== undefined) {
        deptNameMap.set(item.id, item.name || String(item.id));
      }
      if (item.children?.length) {
        visit(item.children);
      }
    });
  };
  visit(departments);
  return ids.map((id) => ({
    label: deptNameMap.get(id) || String(id),
    value: id,
  }));
}

export function useFormSchema(hiddenFields: string[] = []): VbenFormSchema[] {
  return applyFieldPermission(
    [
      {
        component: 'Input',
        fieldName: 'id',
        dependencies: {
          triggerFields: [''],
          show: () => false,
        },
      },
      {
        fieldName: 'mobile',
        label: '手机号码',
        component: 'Input',
        componentProps: {
          placeholder: '请输入手机号码',
        },
        rules: z
          .string({ message: '请输入手机号码' })
          .regex(/^1[3-9]\d{9}$/, '手机号码格式不正确'),
      },
      {
        label: '用户密码',
        fieldName: 'password',
        component: 'InputPassword',
        rules: 'required',
        dependencies: {
          triggerFields: ['id'],
          show: (values) => !values.id,
        },
      },
      {
        fieldName: 'nickname',
        label: '名称',
        component: 'Input',
        componentProps: {
          placeholder: '请输入名称',
        },
        rules: 'required',
      },
      {
        fieldName: 'deptIds',
        label: '归属部门',
        component: 'ApiTreeSelect',
        componentProps: {
          api: async () => handleTree(await getDeptList()),
          labelField: 'name',
          valueField: 'id',
          childrenField: 'children',
          placeholder: '请选择归属部门',
          allowClear: true,
          multiple: true,
          showSearch: true,
          treeNodeFilterProp: 'label',
          treeDefaultExpandAll: true,
          treeCheckable: true,
          treeCheckStrictly: true,
          labelInValue: true,
          filterTreeNode(input: string, node: Recordable<any>) {
            const keyword = input.trim().toLowerCase();
            if (!keyword) {
              return true;
            }
            const label = String(node.label ?? node.name ?? node.title ?? '');
            return label.toLowerCase().includes(keyword);
          },
        },
        rules: 'required',
      },
      {
        fieldName: 'roleIds',
        label: '角色',
        component: 'ApiSelect',
        componentProps: {
          api: getSimpleRoleList,
          labelField: 'name',
          valueField: 'id',
          mode: 'multiple',
          showSearch: true,
          filterOption: (input: string, option: any) =>
            String(option?.label ?? option?.name ?? '')
              .toLowerCase()
              .includes(input.trim().toLowerCase()),
          placeholder: '请选择角色',
        },
        rules: 'required',
      },
      {
        fieldName: 'email',
        label: '邮箱',
        component: 'Input',
        rules: z.string().email('邮箱格式不正确').or(z.literal('')).optional(),
        componentProps: {
          placeholder: '请输入邮箱',
        },
      },
      {
        fieldName: 'sex',
        label: '用户性别',
        component: 'RadioGroup',
        componentProps: {
          options: getDictOptions(DICT_TYPE.SYSTEM_USER_SEX, 'number'),
          buttonStyle: 'solid',
          optionType: 'button',
        },
        rules: z.number().default(1),
      },
      {
        fieldName: 'status',
        label: '用户状态',
        component: 'RadioGroup',
        componentProps: {
          options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
          buttonStyle: 'solid',
          optionType: 'button',
        },
        rules: z.number().default(CommonStatusEnum.ENABLE),
      },
      {
        fieldName: 'remark',
        label: '备注',
        component: 'Textarea',
        componentProps: {
          placeholder: '请输入备注',
        },
      },
    ],
    hiddenFields,
  );
}

export function useResetPasswordFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'id',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: '请输入新密码',
      },
      dependencies: {
        rules(values) {
          return z
            .string({ message: '请输入新密码' })
            .min(5, '密码长度不能少于 5 个字符')
            .max(20, '密码长度不能超过 20 个字符')
            .refine(
              (value) => value !== values.oldPassword,
              '新旧密码不能相同',
            );
        },
        triggerFields: ['newPassword', 'oldPassword'],
      },
      fieldName: 'newPassword',
      label: '新密码',
      rules: 'required',
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: $t('authentication.confirmPassword'),
      },
      dependencies: {
        rules(values) {
          return z
            .string({ message: '请输入确认密码' })
            .min(5, '密码长度不能少于 5 个字符')
            .max(20, '密码长度不能超过 20 个字符')
            .refine(
              (value) => value === values.newPassword,
              '新密码和确认密码不一致',
            );
        },
        triggerFields: ['newPassword', 'confirmPassword'],
      },
      fieldName: 'confirmPassword',
      label: '确认密码',
      rules: 'required',
    },
  ];
}

export function useAssignRoleFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'id',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    {
      fieldName: 'nickname',
      label: '名称',
      component: 'Input',
      componentProps: {
        disabled: true,
      },
    },
    {
      fieldName: 'roleIds',
      label: '角色',
      component: 'ApiSelect',
      componentProps: {
        api: getSimpleRoleList,
        labelField: 'name',
        valueField: 'id',
        mode: 'multiple',
        showSearch: true,
        filterOption: (input: string, option: any) =>
          String(option?.label ?? option?.name ?? '')
            .toLowerCase()
            .includes(input.trim().toLowerCase()),
        placeholder: '请选择角色',
      },
    },
  ];
}

export function useImportFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'file',
      label: '用户数据',
      component: 'Upload',
      rules: 'required',
      help: '仅允许导入 xls、xlsx 格式文件',
    },
    {
      fieldName: 'updateSupport',
      label: '是否覆盖',
      component: 'Switch',
      componentProps: {
        checkedChildren: '是',
        unCheckedChildren: '否',
      },
      rules: z.boolean().default(false),
      help: '是否更新已经存在的用户数据',
    },
  ];
}

export function useGridFormSchema(
  hiddenFields: string[] = [],
): VbenFormSchema[] {
  const searchHiddenFields = hiddenFields.map((field) =>
    field.startsWith('search_') ? field.slice(7) : field,
  );
  if (
    isFieldHidden(hiddenFields, 'roleIds') ||
    isFieldHidden(hiddenFields, 'roleNames')
  ) {
    searchHiddenFields.push('roleId');
  }
  return applyFieldPermission(
    [
      {
        fieldName: 'mobile',
        label: '手机号码',
        component: 'Input',
        componentProps: {
          placeholder: '请输入手机号码',
          allowClear: true,
        },
      },
      {
        fieldName: 'nickname',
        label: '名称',
        component: 'Input',
        componentProps: {
          placeholder: '请输入名称',
          allowClear: true,
        },
      },
      {
        fieldName: 'status',
        label: '用户状态',
        component: 'Select',
        componentProps: {
          popupClassName: 'user-management-search-select-dropdown',
          options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
          placeholder: '请选择用户状态',
          allowClear: true,
        },
      },
      {
        fieldName: 'roleId',
        label: '角色',
        component: 'ApiSelect',
        componentProps: {
          popupClassName: 'user-management-search-select-dropdown',
          api: getSimpleRoleList,
          labelField: 'name',
          valueField: 'id',
          showSearch: true,
          filterOption: (input: string, option: any) =>
            String(option?.label ?? option?.name ?? '')
              .toLowerCase()
              .includes(input.trim().toLowerCase()),
          placeholder: '请选择角色',
          allowClear: true,
        },
      },
      {
        fieldName: 'email',
        label: '邮箱',
        component: 'Input',
        componentProps: {
          placeholder: '请输入邮箱',
          allowClear: true,
        },
      },
      {
        fieldName: 'sex',
        label: '用户性别',
        component: 'Select',
        componentProps: {
          popupClassName: 'user-management-search-select-dropdown',
          options: getDictOptions(DICT_TYPE.SYSTEM_USER_SEX, 'number'),
          placeholder: '请选择用户性别',
          allowClear: true,
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
    ],
    searchHiddenFields,
  );
}

export function useGridColumns(
  onStatusChange?: (
    newStatus: number,
    row: SystemUserApi.User,
  ) => PromiseLike<boolean | undefined>,
  hiddenFields: string[] = [],
  roleNameMap: Record<number, string> = {},
): VxeTableGridOptions['columns'] {
  const columns: VxeTableGridOptions['columns'] = [
    { type: 'checkbox', width: 36, autoFixed: false } as any,
    {
      field: 'nickname',
      title: '用户',
      width: 132,
      sortable: true,
      slots: { default: 'userIdentity' },
    },
    {
      field: 'id',
      title: '用户编号',
      width: 72,
      align: 'center',
      sortable: true,
    },
    {
      field: 'mobile',
      title: '手机号码',
      width: 112,
      sortable: true,
      showOverflow: 'tooltip',
      className: 'user-mobile-column',
    },
    {
      field: 'deptName',
      title: '归属部门',
      width: 112,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'roleNames',
      title: '角色',
      width: 136,
      showOverflow: 'tooltip',
      sortable: true,
      slots: { default: 'userRoles' },
      formatter: ({ row }: { row: SystemUserApi.User }) => {
        if (row.roleNames) {
          return row.roleNames;
        }
        return (
          row.roleIds
            ?.map((roleId) => roleNameMap[roleId])
            .filter(Boolean)
            .join('，') ?? ''
        );
      },
    },
    {
      field: 'email',
      title: '邮箱',
      width: 152,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'sex',
      title: '用户性别',
      width: 76,
      sortable: true,
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.SYSTEM_USER_SEX },
      },
    },
    {
      field: 'status',
      title: '状态',
      width: 72,
      align: 'center',
      sortable: true,
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: 'CellSwitch',
        props: {
          checkedValue: CommonStatusEnum.ENABLE,
          unCheckedValue: CommonStatusEnum.DISABLE,
        },
      },
    },
    { field: 'remark', title: '备注', width: 120, showOverflow: 'tooltip' },
    {
      field: 'createTime',
      title: '创建时间',
      width: 128,
      sortable: true,
      formatter: 'formatDateTime',
    },
    {
      title: '操作',
      width: 176,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return columns?.filter((column: any) => {
    if (!column.field) {
      return true;
    }
    if (column.field === 'deptName') {
      return (
        !isFieldHidden(hiddenFields, 'deptIds') &&
        !isFieldHidden(hiddenFields, 'deptName')
      );
    }
    if (column.field === 'roleNames') {
      return (
        !isFieldHidden(hiddenFields, 'roleIds') &&
        !isFieldHidden(hiddenFields, 'roleNames')
      );
    }
    return !isFieldHidden(hiddenFields, column.field);
  });
}
