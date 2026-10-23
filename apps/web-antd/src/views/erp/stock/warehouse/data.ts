import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemDeptApi } from '#/api/system/dept';
import type { SystemUserApi } from '#/api/system/user';

import { CommonStatusEnum, DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';

import { z } from '#/adapter/form';
import { getEnabledCloudPrintDevices } from '#/api/erp/print';
import {
  getWarehouseDeptSimplePage,
  getWarehouseFormDeptSimplePage,
} from '#/api/erp/stock/warehouse';
import { prepareErpArchiveListColumns } from '#/views/erp/base/utils/archive-list-table';

import {
  applyStockFormFieldPermission,
  applyStockListColumnPermission,
} from '../utils/field-permission';
import {
  formatWarehouseCoordinate,
  parseWarehouseNumber,
} from './warehouse-input';

const warehouseTypeOptions = [
  { label: '物理仓', value: 1 },
  { label: '虚拟仓', value: 2 },
];

const enabledOptions = [
  { label: '启用', value: true },
  { label: '停用', value: false },
];

const stockBillEnabledOptions = [
  { label: '历史设置：生成', value: true },
  { label: '历史设置：不生成', value: false },
];

const yesNoOptions = [
  { label: '是', value: true },
  { label: '否', value: false },
];

const warehouseLocationFieldNames = new Set([
  'address',
  'latitude',
  'longitude',
  'mapName',
]);

function filterSelectOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const label = String(option?.label ?? option?.name ?? option?.value ?? '');
  return label.toLowerCase().includes(keyword);
}

interface WarehouseDeptSelection {
  deptId?: null | number | string;
  deptName?: null | string;
}

interface WarehouseAuditUserSelection {
  creator?: null | number | string;
  creatorName?: null | string;
  updater?: null | number | string;
  updaterName?: null | string;
}

export type CloudPrintDeviceOption = {
  label: string;
  value: number;
};

export async function getCloudPrintDeviceOptions(): Promise<
  CloudPrintDeviceOption[]
> {
  const devices = await getEnabledCloudPrintDevices();
  return (devices || [])
    .filter((device) => device.id !== undefined && device.id !== null)
    .map((device) => ({
      label: `${device.nickname || '云打印设备'} / ${device.devid || '-'}`,
      value: Number(device.id),
    }));
}

function normalizeWarehouseUserId(userId?: null | number | string) {
  if (userId === null || userId === undefined || userId === '') {
    return undefined;
  }
  const value = Number(String(userId).trim());
  return Number.isNaN(value) ? undefined : value;
}

export function needsWarehouseUserNameFallback(
  warehouse?: WarehouseAuditUserSelection,
) {
  return Boolean(
    (!String(warehouse?.creatorName || '').trim() &&
      normalizeWarehouseUserId(warehouse?.creator) !== undefined) ||
    (!String(warehouse?.updaterName || '').trim() &&
      normalizeWarehouseUserId(warehouse?.updater) !== undefined),
  );
}

export function fillWarehouseUserNames<T extends WarehouseAuditUserSelection>(
  warehouse: T,
  userOptions: SystemUserApi.User[] = [],
): T {
  if (!needsWarehouseUserNameFallback(warehouse)) {
    return warehouse;
  }
  const userNameMap = new Map(
    userOptions
      .map(
        (user) => [normalizeWarehouseUserId(user.id), user.nickname] as const,
      )
      .filter(
        (item): item is readonly [number, string] =>
          item[0] !== undefined && Boolean(String(item[1] || '').trim()),
      ),
  );
  const creatorName = String(warehouse.creatorName || '').trim();
  const updaterName = String(warehouse.updaterName || '').trim();
  return {
    ...warehouse,
    creatorName:
      creatorName ||
      userNameMap.get(normalizeWarehouseUserId(warehouse.creator) as number),
    updaterName:
      updaterName ||
      userNameMap.get(normalizeWarehouseUserId(warehouse.updater) as number),
  };
}

function normalizeDeptOptionId(deptId?: null | number | string) {
  if (deptId === null || deptId === undefined || deptId === '') {
    return undefined;
  }
  const value = Number(deptId);
  return Number.isNaN(value) ? undefined : value;
}

export function getWarehouseDeptOptions(
  deptOptions: SystemDeptApi.Dept[] = [],
  selectedDept?: WarehouseDeptSelection,
) {
  const options = deptOptions.map((item) => ({
    label: item.name,
    value: normalizeDeptOptionId(item.id),
  }));
  const selectedDeptId = normalizeDeptOptionId(selectedDept?.deptId);
  const selectedDeptName = String(selectedDept?.deptName || '').trim();
  if (
    selectedDeptId !== undefined &&
    selectedDeptName &&
    !options.some((item) => Number(item.value) === selectedDeptId)
  ) {
    options.push({ label: selectedDeptName, value: selectedDeptId });
  }
  return options;
}

function getDeptSelectProps(
  deptOptions: SystemDeptApi.Dept[] = [],
  selectedDept?: WarehouseDeptSelection,
) {
  return {
    popupClassName: 'warehouse-select-dropdown',
    placeholder: '请选择所属部门',
    allowClear: true,
    showSearch: true,
    optionFilterProp: 'label',
    options: getWarehouseDeptOptions(deptOptions, selectedDept),
  };
}

function formatBoolean(cellValue?: boolean) {
  return cellValue ? '是' : '否';
}

function formatDisabledStatus(cellValue?: number) {
  return cellValue === CommonStatusEnum.DISABLE ? '是' : '否';
}

function formatWarehouseType(cellValue?: number) {
  const match = warehouseTypeOptions.find((item) => item.value === cellValue);
  return match?.label || '';
}

export function shouldShowWarehousePermissionTab(
  formType: 'create' | 'detail' | 'edit',
) {
  return formType !== 'create';
}

function isHiddenField(
  hiddenFields: Set<string> | string[],
  fieldName: string,
) {
  const fields =
    hiddenFields instanceof Set ? hiddenFields : new Set(hiddenFields);
  return fields.has(fieldName) || fields.has(`col_${fieldName}`);
}

export function hasVisibleWarehouseLocationFields(
  hiddenFields: Set<string> | string[] = [],
) {
  return [...warehouseLocationFieldNames].some(
    (fieldName) => !isHiddenField(hiddenFields, fieldName),
  );
}

export function useFormSchema(
  hiddenFields: Set<string> | string[] = [],
  deptOptions: SystemDeptApi.Dept[] = [],
  cloudPrintDeviceOptionsOrFormType:
    | 'create'
    | 'detail'
    | 'edit'
    | CloudPrintDeviceOption[] = [],
  formTypeOrSelectedDept:
    | 'create'
    | 'detail'
    | 'edit'
    | WarehouseDeptSelection = 'edit',
  selectedDept?: WarehouseDeptSelection,
): VbenFormSchema[] {
  const cloudPrintDeviceOptions = Array.isArray(
    cloudPrintDeviceOptionsOrFormType,
  )
    ? cloudPrintDeviceOptionsOrFormType
    : [];
  const formType = Array.isArray(cloudPrintDeviceOptionsOrFormType)
    ? (formTypeOrSelectedDept as 'create' | 'detail' | 'edit')
    : cloudPrintDeviceOptionsOrFormType;
  const currentSelectedDept = Array.isArray(cloudPrintDeviceOptionsOrFormType)
    ? selectedDept
    : (formTypeOrSelectedDept as undefined | WarehouseDeptSelection);
  const schema: VbenFormSchema[] = [
    {
      component: 'Input',
      fieldName: 'id',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    {
      fieldName: 'name',
      label: '仓库名称',
      component: 'Input',
      componentProps: {
        placeholder: '请输入仓库名称',
      },
      rules: 'required',
    },
    {
      fieldName: 'warehouseCode',
      label: '仓库编码',
      component: 'Input',
      componentProps: (values) => {
        const manualInput = Boolean(values.manualInputCode);
        const isEditOrDetail = Boolean(values.id) || formType === 'detail';
        return {
          placeholder: manualInput ? '请输入仓库编码' : '保存后系统自动生成',
          disabled: isEditOrDetail || !manualInput,
          allowClear: manualInput && !isEditOrDetail,
          maxlength: 64,
        };
      },
      dependencies: {
        triggerFields: ['id', 'manualInputCode'],
        rules: (values) =>
          values.manualInputCode && !values.id
            ? z.string().trim().min(1, '请输入仓库编码')
            : z.string().optional(),
      },
    },
    {
      fieldName: 'manualInputCode',
      label: '手动填写',
      component: 'Checkbox',
      componentProps: (values) => ({
        'data-erp-enter-focus-skip': 'true',
        disabled: Boolean(values.id) || formType === 'detail',
      }),
      dependencies: {
        triggerFields: ['id'],
        show: (values) =>
          !values.id &&
          formType === 'create' &&
          !isHiddenField(hiddenFields, 'warehouseCode'),
      },
    },
    {
      fieldName: 'deptId',
      label: '所属部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        ...getDeptSelectProps(deptOptions, currentSelectedDept),
        api: getWarehouseFormDeptSimplePage,
        labelField: 'name',
        valueField: 'id',
        pageSize: 20,
        loadErrorMessage: '部门加载失败，请重试',
      },
      rules: 'required',
    },
    {
      fieldName: 'cloudPrintDeviceId',
      label: '云打印设备',
      component: 'Select',
      componentProps: {
        popupClassName: 'warehouse-form-select-dropdown',
        placeholder: '请选择云打印设备',
        allowClear: true,
        showSearch: true,
        optionFilterProp: 'label',
        options: cloudPrintDeviceOptions,
      },
    },
    {
      fieldName: 'warehouseType',
      label: '仓库类型',
      component: 'Select',
      componentProps: {
        popupClassName: 'warehouse-form-select-dropdown',
        placeholder: '请选择仓库类型',
        options: warehouseTypeOptions,
        allowClear: true,
      },
    },
    {
      fieldName: 'status',
      label: '开启状态',
      component: 'Switch',
      componentProps: {
        checkedChildren: '启用',
        checkedValue: CommonStatusEnum.ENABLE,
        unCheckedChildren: '停用',
        unCheckedValue: CommonStatusEnum.DISABLE,
      },
      defaultValue: CommonStatusEnum.ENABLE,
      rules: z.number().default(CommonStatusEnum.ENABLE),
    },
    {
      fieldName: 'saleEnabled',
      label: '销售启用',
      component: 'Switch',
      componentProps: {
        checkedChildren: '启用',
        unCheckedChildren: '停用',
      },
      defaultValue: true,
    },
    {
      fieldName: 'purchaseEnabled',
      label: '采购启用',
      component: 'Switch',
      componentProps: {
        checkedChildren: '启用',
        unCheckedChildren: '停用',
      },
      defaultValue: true,
    },
    {
      fieldName: 'stockBillEnabled',
      label: '历史领货设置',
      component: 'Switch',
      componentProps: {
        checkedChildren: '原生成',
        unCheckedChildren: '原不生成',
        disabled: true,
      },
      defaultValue: false,
    },
    {
      fieldName: 'scanControl',
      label: '扫码管控',
      component: 'Switch',
      componentProps: {
        checkedChildren: '是',
        unCheckedChildren: '否',
      },
      defaultValue: false,
    },
    {
      fieldName: 'splitOrder',
      label: '是否拆单',
      component: 'Switch',
      componentProps: {
        checkedChildren: '是',
        unCheckedChildren: '否',
      },
      defaultValue: true,
    },
    {
      fieldName: 'sort',
      label: '排序',
      component: 'Input',
      componentProps: { placeholder: '请输入排序', inputmode: 'numeric' },
      rules: z
        .any()
        .refine(
          (value) =>
            value !== '' &&
            value !== null &&
            value !== undefined &&
            Number.isFinite(parseWarehouseNumber(value)),
          '请输入有效整数',
        ),
    },
    {
      fieldName: 'remark',
      label: '备注',
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入备注',
        autoSize: { minRows: 1, maxRows: 1 },
      },
    },
  ];
  const filteredSchema =
    formType === 'create'
      ? schema.filter((item) => item.fieldName !== 'sort')
      : schema;
  return applyStockFormFieldPermission(filteredSchema, hiddenFields);
}

export function useLocationFormSchema(
  hiddenFields: Set<string> | string[] = [],
): VbenFormSchema[] {
  return applyStockFormFieldPermission(
    [
      {
        fieldName: 'address',
        label: '仓库地址',
        component: 'Input',
        componentProps: {
          placeholder: '请输入仓库地址',
          maxlength: 255,
        },
      },
      {
        fieldName: 'mapName',
        label: '地图名称',
        component: 'Input',
        componentProps: {
          placeholder: '请输入地图显示名称',
          maxlength: 100,
        },
      },
      {
        fieldName: 'longitude',
        label: '经度',
        component: 'Input',
        componentProps: {
          placeholder: '请输入 GCJ-02 经度',
          inputmode: 'decimal',
        },
        rules: z.any().refine((value) => {
          const number = parseWarehouseNumber(value, 180);
          return number === undefined || Number.isFinite(number);
        }, '经度须在 -180 到 180 之间，最多六位小数'),
      },
      {
        fieldName: 'latitude',
        label: '纬度',
        component: 'Input',
        componentProps: {
          placeholder: '请输入 GCJ-02 纬度',
          inputmode: 'decimal',
        },
        rules: z.any().refine((value) => {
          const number = parseWarehouseNumber(value, 90);
          return number === undefined || Number.isFinite(number);
        }, '纬度须在 -90 到 90 之间，最多六位小数'),
      },
    ],
    hiddenFields,
  );
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'warehouseCode',
      label: '编码',
      component: 'Input',
      componentProps: {
        placeholder: '请输入编码',
        allowClear: true,
      },
    },
    {
      fieldName: 'name',
      label: '名称',
      component: 'Input',
      componentProps: {
        placeholder: '请输入名称',
        allowClear: true,
      },
    },
    {
      fieldName: 'deptId',
      label: '所属部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: getWarehouseDeptSimplePage,
        labelField: 'name',
        valueField: 'id',
        popupClassName: 'warehouse-select-dropdown',
        placeholder: '请选择所属部门',
        allowClear: true,
        showSearch: true,
        pageSize: 10,
        loadErrorMessage: '部门列表加载失败，请重试',
      },
    },
    {
      fieldName: 'warehouseType',
      label: '仓库类型',
      component: 'Select',
      componentProps: {
        popupClassName: 'warehouse-select-dropdown',
        placeholder: '请选择仓库类型',
        allowClear: true,
        showSearch: true,
        filterOption: filterSelectOption,
        options: warehouseTypeOptions,
      },
    },
    {
      fieldName: 'status',
      label: '开启状态',
      component: 'Select',
      componentProps: {
        popupClassName: 'warehouse-select-dropdown',
        placeholder: '请选择开启状态',
        allowClear: true,
        showSearch: true,
        filterOption: filterSelectOption,
        options: getDictOptions(DICT_TYPE.COMMON_STATUS, 'number'),
      },
    },
    {
      fieldName: 'saleEnabled',
      label: '销售启用',
      component: 'Select',
      componentProps: {
        popupClassName: 'warehouse-select-dropdown',
        placeholder: '请选择销售启用',
        allowClear: true,
        showSearch: true,
        filterOption: filterSelectOption,
        options: enabledOptions,
      },
    },
    {
      fieldName: 'purchaseEnabled',
      label: '采购启用',
      component: 'Select',
      componentProps: {
        popupClassName: 'warehouse-select-dropdown',
        placeholder: '请选择采购启用',
        allowClear: true,
        showSearch: true,
        filterOption: filterSelectOption,
        options: enabledOptions,
      },
    },
    {
      fieldName: 'stockBillEnabled',
      label: '历史领货设置',
      component: 'Select',
      componentProps: {
        popupClassName: 'warehouse-select-dropdown',
        placeholder: '请选择历史设置',
        allowClear: true,
        showSearch: true,
        filterOption: filterSelectOption,
        options: stockBillEnabledOptions,
      },
    },
    {
      fieldName: 'scanControl',
      label: '扫码管控',
      component: 'Select',
      componentProps: {
        popupClassName: 'warehouse-select-dropdown',
        placeholder: '请选择扫码管控',
        allowClear: true,
        showSearch: true,
        filterOption: filterSelectOption,
        options: yesNoOptions,
      },
    },
    {
      fieldName: 'splitOrder',
      label: '是否拆单',
      component: 'Select',
      componentProps: {
        popupClassName: 'warehouse-select-dropdown',
        placeholder: '请选择是否拆单',
        allowClear: true,
        showSearch: true,
        filterOption: filterSelectOption,
        options: yesNoOptions,
      },
    },
    {
      fieldName: 'remark',
      label: '备注',
      component: 'Input',
      componentProps: {
        placeholder: '请输入备注',
        allowClear: true,
      },
    },
  ];
}

export function useGridColumns(
  hiddenFields: Set<string> | string[] = [],
  rows: Record<string, any>[] = [],
): VxeTableGridOptions['columns'] {
  const columns: VxeTableGridOptions['columns'] = [
    {
      type: 'checkbox',
      width: 36,
      autoFixed: false,
    } as any,
    {
      field: 'name',
      title: '仓库名称',
      width: 132,
      align: 'center',
      sortable: true,
      showOverflow: 'tooltip',
      className: 'warehouse-name-column',
      slots: { default: 'name' },
    },
    {
      field: 'remark',
      title: '备注',
      width: 140,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'warehouseType',
      title: '仓库类型',
      width: 84,
      sortable: true,
      formatter: ({ cellValue }) => formatWarehouseType(cellValue),
    },
    {
      field: 'status',
      title: '停用标识',
      width: 84,
      sortable: true,
      formatter: ({ cellValue }) => formatDisabledStatus(cellValue),
    },
    {
      field: 'saleEnabled',
      title: '销售',
      width: 60,
      sortable: true,
      formatter: ({ cellValue }) => formatBoolean(cellValue),
    },
    {
      field: 'purchaseEnabled',
      title: '采购',
      width: 60,
      sortable: true,
      formatter: ({ cellValue }) => formatBoolean(cellValue),
    },
    {
      field: 'deptName',
      title: '部门',
      width: 96,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'cloudPrintDeviceId',
      title: '云打印设备',
      width: 112,
      showOverflow: 'tooltip',
      formatter: ({ cellValue }) =>
        cellValue ? `已绑定 #${cellValue}` : '未绑定',
    },
    {
      field: 'address',
      title: '仓库地址',
      width: 160,
      showOverflow: 'tooltip',
    },
    {
      field: 'mapName',
      title: '地图名称',
      width: 120,
      showOverflow: 'tooltip',
    },
    {
      field: 'longitude',
      formatter: ({ cellValue }) => formatWarehouseCoordinate(cellValue),
      title: '经度',
      width: 96,
    },
    {
      field: 'latitude',
      formatter: ({ cellValue }) => formatWarehouseCoordinate(cellValue),
      title: '纬度',
      width: 96,
    },
    {
      field: 'stockBillEnabled',
      title: '历史领货设置',
      width: 120,
      sortable: true,
      formatter: ({ cellValue }) => formatBoolean(cellValue),
    },
    {
      field: 'readonlyBySaleDistribution',
      title: '是否共享配件档案',
      width: 128,
      formatter: ({ cellValue }) => formatBoolean(cellValue),
    },
    {
      field: 'creatorName',
      title: '创建人',
      width: 72,
      showOverflow: 'tooltip',
    },
    {
      field: 'createTime',
      title: '创建时间',
      width: 112,
      formatter: 'formatDateTime',
    },
    {
      field: 'updaterName',
      title: '修改人',
      width: 72,
      showOverflow: 'tooltip',
    },
    {
      field: 'updateTime',
      title: '修改时间',
      width: 112,
      formatter: 'formatDateTime',
    },
    {
      field: 'actions',
      title: '操作',
      width: 262,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
  return prepareErpArchiveListColumns(
    applyStockListColumnPermission(columns, hiddenFields) || [],
    rows,
  );
}
