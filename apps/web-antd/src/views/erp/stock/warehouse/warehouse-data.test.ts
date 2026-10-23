import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CommonStatusEnum } from '@vben/constants';

import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import {
  fillWarehouseUserNames,
  getWarehouseDeptOptions,
  hasVisibleWarehouseLocationFields,
  needsWarehouseUserNameFallback,
  shouldShowWarehousePermissionTab,
  useFormSchema,
  useGridColumns,
  useGridFormSchema,
  useLocationFormSchema,
} from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');

describe('warehouse list design contract', () => {
  it('keeps legacy pickup value queryable but disabled in create/edit/detail schemas', () => {
    setActivePinia(createPinia());
    for (const mode of ['create', 'edit', 'detail'] as const) {
      const field = useFormSchema([], [], mode).find(
        (item) => item.fieldName === 'stockBillEnabled',
      );
      expect(field?.componentProps).toMatchObject({ disabled: true });
      expect(field?.label).toBe('历史领货设置');
    }
    const historyFilter = useGridFormSchema().find(
      (item) => item.fieldName === 'stockBillEnabled',
    );
    expect(historyFilter?.componentProps).toMatchObject({
      options: [
        { label: '历史设置：生成', value: true },
        { label: '历史设置：不生成', value: false },
      ],
    });
    expect(
      useFormSchema(['stockBillEnabled'], [], 'edit').some(
        (item) => item.fieldName === 'stockBillEnabled',
      ),
    ).toBe(false);
  });

  it('exposes cloud print device binding in the warehouse form and list', () => {
    const schema = useFormSchema(
      [],
      [],
      [{ label: '成都 / SW263000012', value: 1 }],
      'edit',
    );
    const field = schema.find(
      (item) => item.fieldName === 'cloudPrintDeviceId',
    );
    const columns = useGridColumns() as any[];
    const column = columns.find((item) => item.field === 'cloudPrintDeviceId');

    expect(field).toMatchObject({
      component: 'Select',
      label: '云打印设备',
    });
    expect((field?.componentProps as any)?.options).toEqual([
      { label: '成都 / SW263000012', value: 1 },
    ]);
    expect(column).toMatchObject({
      field: 'cloudPrintDeviceId',
      title: '云打印设备',
    });
    expect(column.formatter({ cellValue: 1 })).toBe('已绑定 #1');
    expect(column.formatter({ cellValue: undefined })).toBe('未绑定');
  });

  it('keeps the requested business fields in the exact order', () => {
    const columns = useGridColumns() as any[];
    const titles = columns
      .filter((column) => column.type !== 'checkbox' && column.title !== '操作')
      .map((column) => column.title);

    expect(titles).toEqual([
      '仓库名称',
      '备注',
      '仓库类型',
      '停用标识',
      '销售',
      '采购',
      '部门',
      '云打印设备',
      '仓库地址',
      '地图名称',
      '经度',
      '纬度',
      '历史领货设置',
      '是否共享配件档案',
      '创建人',
      '创建时间',
      '修改人',
      '修改时间',
    ]);
  });

  it('keeps leading columns scrollable and fixes only the operation column', () => {
    const columns = useGridColumns() as any[];

    expect(columns[0]).toMatchObject({
      autoFixed: false,
      type: 'checkbox',
      width: 36,
    });
    expect(
      columns
        .filter((column) => column.fixed)
        .map((column) => ({ fixed: column.fixed, title: column.title })),
    ).toEqual([{ fixed: 'right', title: '操作' }]);
    expect(columns.at(-1)).toMatchObject({
      field: 'actions',
      fixed: 'right',
      title: '操作',
      width: 262,
    });
  });

  it('centers the warehouse name cell content', () => {
    const columns = useGridColumns() as any[];
    const nameColumn = columns.find((column) => column.field === 'name');

    expect(nameColumn).toMatchObject({
      align: 'center',
      className: 'warehouse-name-column',
    });
    expect(indexSource).toContain('width: 100%');
    expect(indexSource).toContain('text-align: center');
    expect(indexSource).toContain('justify-content: center');
  });

  it('hides permission distribution only when creating a warehouse', () => {
    expect(shouldShowWarehousePermissionTab('create')).toBe(false);
    expect(shouldShowWarehousePermissionTab('edit')).toBe(true);
    expect(shouldShowWarehousePermissionTab('detail')).toBe(true);
  });

  it('uses the sales-cart fullscreen four-column section layout in every mode', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain(
      "wrapperClass: 'warehouse-basic-grid grid-cols-4'",
    );
    expect(formSource).toContain('labelWidth: 82');
    expect(formSource).toContain('compact: true');
    expect(formSource).toContain(
      'class="warehouse-form-section__title">基本信息',
    );
    expect(formSource).toContain(
      'class="warehouse-form-section__title">位置信息',
    );
    expect(formSource).toContain('<LocationForm');
    expect(formSource).toContain('showLocationSection');
    expect(formSource).toContain(
      'class="warehouse-form-section__title">审计信息',
    );
    expect(formSource).toContain('warehouse-edit-form--editable');
    expect(formSource).toContain('warehouse-edit-form--readonly');
    expect(formSource).toContain(
      'grid-template-columns: repeat(4, minmax(0, 1fr))',
    );
  });

  it('keeps explicit warehouse loading, failure, and successful form exits', () => {
    expect(formSource).toContain('dataLoading.value = true');
    expect(formSource).toContain(
      "dataLoadError.value = '仓库信息加载失败，请关闭后重试'",
    );
    expect(formSource).toContain('dataLoading.value = false');
    expect(formSource).toContain('v-else-if="dataLoadError"');
  });

  it('keeps the form mounted while loading so initialization cannot deadlock', () => {
    expect(formSource).toContain('v-show="!dataLoading && !dataLoadError"');
    expect(formSource).not.toContain('<template v-else>');

    const openHandler = formSource.slice(
      formSource.indexOf('async onOpenChange'),
      formSource.indexOf('</script>'),
    );
    expect(openHandler).not.toContain('modalApi.lock()');
    expect(openHandler).not.toContain('modalApi.unlock()');
  });

  it('keeps basic and location warehouse forms in separate compact sections', () => {
    setActivePinia(createPinia());
    const schema = useFormSchema([], [], 'edit');
    const locationSchema = useLocationFormSchema([]);
    const remark = schema.find((item) => item.fieldName === 'remark');
    const warehouseType = schema.find(
      (item) => item.fieldName === 'warehouseType',
    );
    const address = locationSchema.find((item) => item.fieldName === 'address');
    const mapName = locationSchema.find((item) => item.fieldName === 'mapName');
    const longitude = locationSchema.find(
      (item) => item.fieldName === 'longitude',
    );
    const latitude = locationSchema.find(
      (item) => item.fieldName === 'latitude',
    );
    const basicFieldOrder = schema
      .map((item) => item.fieldName)
      .filter((fieldName) =>
        ['deptId', 'saleEnabled', 'status', 'warehouseType'].includes(
          String(fieldName),
        ),
      );

    expect(schema.some((item) => item.fieldName === 'address')).toBe(false);
    expect(schema.some((item) => item.fieldName === 'mapName')).toBe(false);
    expect(schema.some((item) => item.fieldName === 'longitude')).toBe(false);
    expect(schema.some((item) => item.fieldName === 'latitude')).toBe(false);
    expect(remark?.formItemClass).toBeUndefined();
    expect((remark?.componentProps as any)?.autoSize).toEqual({
      maxRows: 1,
      minRows: 1,
    });
    expect((warehouseType?.componentProps as any)?.popupClassName).toBe(
      'warehouse-form-select-dropdown',
    );
    expect(basicFieldOrder).toEqual([
      'deptId',
      'warehouseType',
      'status',
      'saleEnabled',
    ]);
    expect(locationSchema.map((item) => item.fieldName)).toEqual([
      'address',
      'mapName',
      'longitude',
      'latitude',
    ]);
    expect(address).toMatchObject({
      component: 'Input',
      label: '仓库地址',
    });
    expect(mapName).toMatchObject({
      component: 'Input',
      label: '地图名称',
    });
    expect(longitude).toMatchObject({
      component: 'Input',
      label: '经度',
    });
    expect(latitude).toMatchObject({
      component: 'Input',
      label: '纬度',
    });
    expect((longitude?.componentProps as any)?.inputmode).toBe('decimal');
    expect((latitude?.componentProps as any)?.inputmode).toBe('decimal');
  });

  it('hides the location section when all location fields are hidden by permission', () => {
    setActivePinia(createPinia());
    const locationSchema = useLocationFormSchema([
      'address',
      'mapName',
      'longitude',
      'latitude',
    ]);

    expect(locationSchema).toEqual([]);
    expect(
      hasVisibleWarehouseLocationFields([
        'address',
        'mapName',
        'longitude',
        'latitude',
      ]),
    ).toBe(false);
    expect(hasVisibleWarehouseLocationFields(['address'])).toBe(true);
    expect(formSource).toContain('v-if="showLocationSection"');
  });

  it('shows the owner department name for a distributed warehouse detail', () => {
    const activeDeptOptions = [{ id: '1', name: '大邑分公司' }] as any[];
    const assignedDept = { deptId: '148', deptName: '兴宇路通' };

    expect(getWarehouseDeptOptions(activeDeptOptions, assignedDept)).toEqual([
      { label: '大邑分公司', value: 1 },
      { label: '兴宇路通', value: 148 },
    ]);
    expect(
      getWarehouseDeptOptions(
        [...activeDeptOptions, { id: '148', name: '兴宇路通' } as any],
        assignedDept,
      ),
    ).toEqual([
      { label: '大邑分公司', value: 1 },
      { label: '兴宇路通', value: 148 },
    ]);

    const detailDept = useFormSchema(
      [],
      activeDeptOptions,
      'detail',
      assignedDept,
    ).find((item) => item.fieldName === 'deptId');
    expect((detailDept?.componentProps as any)?.options).toContainEqual({
      label: '兴宇路通',
      value: 148,
    });

    const detailHydration = formSource.slice(
      formSource.indexOf('const warehouse = await getWarehouse('),
      formSource.indexOf('// 设置到 values'),
    );
    expect(detailHydration).toContain('useFormSchema(');
    expect(detailHydration).toContain('formData.value,');
    expect(detailHydration).toContain('await nextTick()');
  });

  it('fills creator and updater names when an environment returns only ids', () => {
    const warehouse = {
      creator: ' 101 ',
      updater: '102',
    };
    const users = [
      { id: 101, nickname: '创建用户' },
      { id: 102, nickname: '修改用户' },
    ] as any[];

    expect(needsWarehouseUserNameFallback(warehouse)).toBe(true);
    expect(fillWarehouseUserNames(warehouse, users)).toEqual({
      ...warehouse,
      creatorName: '创建用户',
      updaterName: '修改用户',
    });
    expect(
      fillWarehouseUserNames({ ...warehouse, creatorName: '接口创建人' }, users)
        .creatorName,
    ).toBe('接口创建人');
    expect(indexSource).not.toContain('getSimpleUserList');
    expect(formSource).not.toContain('getSimpleUserList');
  });

  it('uses a numeric status switch and a single-layer warehouse-code shell', () => {
    setActivePinia(createPinia());
    const createSchema = useFormSchema([], [], 'create');
    const editSchema = useFormSchema([], [], 'edit');
    const detailSchema = useFormSchema([], [], 'detail');
    const status = createSchema.find((item) => item.fieldName === 'status');
    const createCode = createSchema.find(
      (item) => item.fieldName === 'warehouseCode',
    );
    const editCode = editSchema.find(
      (item) => item.fieldName === 'warehouseCode',
    );
    const detailCode = detailSchema.find(
      (item) => item.fieldName === 'warehouseCode',
    );
    const getProps = (schema: typeof createCode, values: Record<string, any>) =>
      typeof schema?.componentProps === 'function'
        ? schema.componentProps(values, {} as any)
        : schema?.componentProps;

    expect(status).toMatchObject({
      component: 'Switch',
      defaultValue: CommonStatusEnum.ENABLE,
      componentProps: {
        checkedChildren: '启用',
        checkedValue: CommonStatusEnum.ENABLE,
        unCheckedChildren: '停用',
        unCheckedValue: CommonStatusEnum.DISABLE,
      },
    });
    expect(getProps(createCode, { manualInputCode: false })).toMatchObject({
      disabled: true,
    });
    expect(getProps(createCode, { manualInputCode: true })).toMatchObject({
      disabled: false,
    });
    expect(getProps(editCode, { id: 1, manualInputCode: true })).toMatchObject({
      disabled: true,
    });
    expect(getProps(detailCode, { manualInputCode: true })).toMatchObject({
      disabled: true,
    });
    expect(formSource).toContain(
      '.warehouse-edit-form :deep(.ant-input-affix-wrapper > input.ant-input)',
    );
    expect(formSource).toContain('background: transparent !important');
  });

  it('formats warehouse state columns with concise yes-or-no values', () => {
    const columns = useGridColumns() as any[];
    const disabledColumn = columns.find((column) => column.field === 'status');
    const sharedColumn = columns.find(
      (column) => column.field === 'readonlyBySaleDistribution',
    );

    expect(
      disabledColumn.formatter({ cellValue: CommonStatusEnum.DISABLE }),
    ).toBe('是');
    expect(
      disabledColumn.formatter({ cellValue: CommonStatusEnum.ENABLE }),
    ).toBe('否');
    expect(sharedColumn.formatter({ cellValue: true })).toBe('是');
    expect(sharedColumn.formatter({ cellValue: false })).toBe('否');
  });

  it('uses the compact dropdown typography hook for every search select', () => {
    setActivePinia(createPinia());
    const searchSelects = useGridFormSchema().filter((schema) =>
      String(schema.component).includes('Select'),
    );

    expect(searchSelects.length).toBeGreaterThan(0);
    expect(
      searchSelects.every(
        (schema) =>
          (schema.componentProps as any)?.popupClassName ===
          'warehouse-select-dropdown',
      ),
    ).toBe(true);
  });
});
