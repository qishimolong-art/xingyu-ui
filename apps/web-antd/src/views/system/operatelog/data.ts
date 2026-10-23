import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DescriptionItemSchema } from '#/components/description';

import { h } from 'vue';

import { DICT_TYPE } from '@vben/constants';
import { formatDateTime } from '@vben/utils';

import { getOperateLogModuleOptions } from '#/api/system/operate-log';
import { getSimpleUserList } from '#/api/system/user';
import { DictTag } from '#/components/dict-tag';
import { getRangePickerDefaultProps } from '#/utils';

/** 列表的搜索表单 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'userId',
      label: '操作人',
      component: 'ApiSelect',
      componentProps: {
        api: getSimpleUserList,
        labelField: 'nickname',
        valueField: 'id',
        allowClear: true,
        placeholder: '请选择操作人员',
        popupClassName: 'operate-log-search-select-dropdown',
      },
    },
    {
      fieldName: 'type',
      label: '操作模块',
      component: 'ApiSelect',
      componentProps: {
        api: getOperateLogModuleOptions,
        labelField: 'label',
        valueField: 'value',
        allowClear: true,
        showSearch: true,
        optionFilterProp: 'label',
        placeholder: '请选择操作模块/表单',
        popupClassName: 'operate-log-search-select-dropdown',
      },
    },
    {
      fieldName: 'subType',
      label: '操作名',
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '请输入操作名',
      },
    },
    {
      fieldName: 'action',
      label: '操作内容',
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '请输入操作内容',
      },
    },
    {
      fieldName: 'createTime',
      label: '操作时间',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
  ];
}

/** 列表的字段 */
export function useGridColumns(): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'id',
      title: '日志编号',
      width: 88,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'userName',
      title: '操作人',
      width: 88,
      showOverflow: 'tooltip',
    },
    {
      field: 'type',
      title: '操作模块',
      width: 108,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'subType',
      title: '操作名',
      width: 120,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'action',
      title: '操作内容',
      minWidth: 300,
      showOverflow: 'tooltip',
    },
    {
      field: 'createTime',
      title: '操作时间',
      width: 148,
      sortable: true,
      formatter: 'formatDateTime',
      showOverflow: 'tooltip',
    },
    {
      field: 'userIp',
      title: '操作 IP',
      width: 116,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      title: '操作',
      width: 64,
      fixed: 'right',
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
      field: 'bizId',
      label: '业务编号',
      show: (data) => data?.bizId !== undefined && data?.bizId !== null,
    },
    {
      field: 'type',
      label: '操作模块',
    },
    {
      field: 'subType',
      label: '操作名',
    },
    {
      field: 'userId',
      label: '操作人编号',
    },
    {
      field: 'userType',
      label: '操作人类型',
      render: (val) => h(DictTag, { type: DICT_TYPE.USER_TYPE, value: val }),
    },
    {
      field: 'userName',
      label: '操作人姓名',
    },
    {
      field: 'userIp',
      label: '操作人 IP',
    },
    {
      field: 'createTime',
      label: '操作时间',
      span: 2,
      render: (val) => formatDateTime(val) as string,
    },
    {
      field: 'requestUrl',
      label: '请求 URL',
      span: 2,
      render: (val, data) => {
        if (data?.requestMethod && val) {
          return `${data.requestMethod} ${val}`;
        }
        return val || '-';
      },
    },
    {
      field: 'userAgent',
      label: '操作人 UA',
      span: 2,
    },
    {
      field: 'action',
      label: '操作内容',
      span: 2,
    },
    {
      field: 'extra',
      label: '操作拓展参数',
      span: 2,
      show: (data) => Boolean(data?.extra),
    },
    {
      field: 'traceId',
      label: '链路追踪编号',
      span: 2,
      show: (data) => Boolean(data?.traceId),
    },
  ];
}
