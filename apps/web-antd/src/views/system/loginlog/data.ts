import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemLoginLogApi } from '#/api/system/login-log';
import type { DescriptionItemSchema } from '#/components/description';

import { h } from 'vue';

import { DICT_TYPE } from '@vben/constants';
import { formatDateTime } from '@vben/utils';

import { DictTag } from '#/components/dict-tag';
import { getRangePickerDefaultProps } from '#/utils';

/** 列表的搜索表单 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'username',
      label: '用户名称',
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '请输入用户名称',
      },
    },
    {
      fieldName: 'userIp',
      label: '登录地址',
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '请输入登录地址',
      },
    },
    {
      fieldName: 'status',
      label: '登录结果',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '成功', value: true },
          { label: '失败', value: false },
        ],
        placeholder: '请选择登录结果',
        popupClassName: 'login-log-search-select-dropdown',
      },
    },
    {
      fieldName: 'createTime',
      label: '登录时间',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
  ];
}

/** 列表的字段 */
export function useGridColumns(): VxeTableGridOptions<SystemLoginLogApi.LoginLog>['columns'] {
  return [
    {
      field: 'id',
      title: '日志编号',
      width: 96,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'logType',
      title: '登录类型',
      width: 104,
      sortable: true,
      showOverflow: 'tooltip',
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.SYSTEM_LOGIN_TYPE },
      },
    },
    {
      field: 'username',
      title: '用户名称',
      minWidth: 140,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'userIp',
      title: '登录地址',
      width: 128,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'userAgent',
      title: '浏览器',
      minWidth: 260,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'result',
      title: '登录结果',
      width: 112,
      sortable: true,
      showOverflow: 'tooltip',
      cellRender: {
        name: 'CellDict',
        props: { type: DICT_TYPE.SYSTEM_LOGIN_RESULT },
      },
    },
    {
      field: 'createTime',
      title: '登录日期',
      width: 152,
      sortable: true,
      formatter: 'formatDateTime',
      showOverflow: 'tooltip',
    },
    {
      title: '操作',
      width: 64,
      fixed: 'right',
      resizable: false,
      slots: { default: 'actions' },
    },
  ];
}

/** 详情页的字段 */
export function useDetailSchema(): DescriptionItemSchema[] {
  return [
    {
      field: 'id',
      label: '日志编号',
    },
    {
      field: 'logType',
      label: '登录类型',
      render: (val) => {
        return h(DictTag, {
          type: DICT_TYPE.SYSTEM_LOGIN_TYPE,
          value: val,
        });
      },
    },
    {
      field: 'userId',
      label: '用户编号',
    },
    {
      field: 'userType',
      label: '用户类型',
      render: (val) => {
        return h(DictTag, {
          type: DICT_TYPE.USER_TYPE,
          value: val,
        });
      },
    },
    {
      field: 'username',
      label: '用户名称',
    },
    {
      field: 'userIp',
      label: '登录地址',
    },
    {
      field: 'userAgent',
      label: '浏览器',
      span: 2,
    },
    {
      field: 'result',
      label: '登录结果',
      render: (val) => {
        return h(DictTag, {
          type: DICT_TYPE.SYSTEM_LOGIN_RESULT,
          value: val,
        });
      },
    },
    {
      field: 'createTime',
      label: '登录日期',
      render: (val) => formatDateTime(val) as string,
    },
    {
      field: 'traceId',
      label: '链路追踪编号',
      span: 2,
      show: (data) => Boolean(data?.traceId),
    },
  ];
}
