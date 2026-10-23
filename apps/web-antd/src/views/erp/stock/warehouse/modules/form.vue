<script lang="ts" setup>
import { provide as provideStockDecimalMode } from 'vue';
const emit = defineEmits<{
  (e: 'edit', warehouse: ErpWarehouseApi.Warehouse): void;
  (e: 'success', warehouse?: ErpWarehouseApi.Warehouse): void;
}>();
provideStockDecimalMode('stock-decimal-context', true);
import type { ErpWarehouseApi } from '#/api/erp/stock/warehouse';
import type { SystemDeptApi } from '#/api/system/dept';

import { computed, nextTick, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Button, message, Tabs } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createWarehouse,
  getWarehouse,
  getWarehouseFormDeptSimplePage,
  updateWarehouse,
} from '#/api/erp/stock/warehouse';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import { withCandidateFocus } from '#/views/erp/utils/candidate-focus';
import {
  focusFirstEditableFormControl,
  focusNextEditableFormControlOnEnter,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';

import {
  getCloudPrintDeviceOptions,
  hasVisibleWarehouseLocationFields,
  shouldShowWarehousePermissionTab,
  useFormSchema,
  useLocationFormSchema,
} from '../data';
import { parseWarehouseNumber } from '../warehouse-input';
import SaleDeptPermission from './sale-dept-permission.vue';

import '#/views/erp/styles/form-focus.css';

const FIELD_PERMISSION_MODULE = 'erp_warehouse';
const formData = ref<ErpWarehouseApi.Warehouse>();
const deptOptions = ref<SystemDeptApi.Dept[]>([]);
const cloudPrintDeviceOptions = ref<
  Awaited<ReturnType<typeof getCloudPrintDeviceOptions>>
>([]);
const formType = ref<'create' | 'detail' | 'edit'>('create');
const activeTabKey = ref('base');
const dataLoading = ref(false);
const dataLoadError = ref('');
const submitInFlight = ref(false);
let dataLoadSequence = 0;
const formScope = ref<HTMLElement>();
let modalOpened = false;
let initialFocusDone = false;
function queueInitialFocus() {
  const sequence = dataLoadSequence;
  queueAfterEditableControlRender(() => {
    if (
      sequence !== dataLoadSequence ||
      !modalOpened ||
      initialFocusDone ||
      !canSubmit.value ||
      !formScope.value
    )
      return;
    initialFocusDone = focusFirstEditableFormControl(formScope.value);
  });
}
function handleFormEnter(event: KeyboardEvent) {
  const scope = formScope.value;
  if (
    !scope ||
    isReadonly.value ||
    dataLoading.value ||
    activeTabKey.value !== 'base'
  )
    return;
  const target = event.target;
  if (
    !(target instanceof HTMLElement) ||
    target.closest('[role="dialog"]') !== scope.closest('[role="dialog"]')
  )
    return;
  const handled = focusNextEditableFormControlOnEnter(event, scope, {
    onLastControlEnter: () => target.focus({ preventScroll: true }),
  });
  if (handled) event.stopPropagation();
}
const isDetail = computed(() => formType.value === 'detail');
const showPermissionTab = computed(
  () =>
    shouldShowWarehousePermissionTab(formType.value) &&
    hasAccessByCodes([
      'erp:warehouse-permission:query',
      'erp:warehouse-permission:update',
    ]),
);
const isReadonlyBySaleDistribution = computed(
  () => formData.value?.readonlyBySaleDistribution === true,
);
const isReadonly = computed(
  () => isDetail.value || isReadonlyBySaleDistribution.value,
);
const canSubmit = computed(
  () => !isReadonly.value && !dataLoading.value && !dataLoadError.value,
);
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const showLocationSection = computed(() =>
  hasVisibleWarehouseLocationFields(hiddenFields.value),
);
const userStore = useUserStore();
const { hasAccessByCodes } = useAccess();
const canEditFromDetail = computed(
  () =>
    isDetail.value &&
    !!formData.value?.id &&
    !isReadonlyBySaleDistribution.value &&
    !dataLoading.value &&
    !dataLoadError.value &&
    hasAccessByCodes(['erp:warehouse:update']),
);

const getTitle = computed(() => {
  if (formType.value === 'detail') {
    return $t('common.detail');
  }
  return formType.value === 'edit'
    ? $t('ui.actionTitle.edit', ['仓库'])
    : $t('ui.actionTitle.create', ['仓库']);
});

function normalizeDeptId(deptId?: null | number | string) {
  if (deptId === null || deptId === undefined || deptId === '') {
    return undefined;
  }
  const value = Number(deptId);
  return Number.isNaN(value) ? undefined : value;
}

const formConfig = {
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  compact: true,
  layout: 'horizontal' as const,
  showDefaultActions: false,
};

const [Form, formApi] = useVbenForm({
  ...formConfig,
  wrapperClass: 'warehouse-basic-grid grid-cols-4',
  schema: withCandidateFocus(useFormSchema([], [], [], formType.value)),
  handleValuesChange(values, changedFields) {
    if (changedFields.includes('manualInputCode') && !values.id) {
      formApi.setFieldValue(
        'warehouseCode',
        values.manualInputCode ? '' : undefined,
      );
    }
  },
});

const [LocationForm, locationFormApi] = useVbenForm({
  ...formConfig,
  wrapperClass: 'warehouse-location-grid grid-cols-4',
  schema: withCandidateFocus(useLocationFormSchema()),
});

function normalizeWarehouseManualCode(
  data: ErpWarehouseApi.Warehouse & Record<string, any>,
) {
  const normalized = { ...data };
  if (typeof normalized.warehouseCode === 'string') {
    const warehouseCode = normalized.warehouseCode.trim();
    normalized.warehouseCode = warehouseCode || undefined;
  }
  for (const [field, limit] of [
    ['sort', undefined],
    ['longitude', 180],
    ['latitude', 90],
  ] as const) {
    if (Object.hasOwn(normalized, field))
      normalized[field] = parseWarehouseNumber(normalized[field], limit);
  }
  delete normalized.manualInputCode;
  return normalized as ErpWarehouseApi.Warehouse;
}

async function handleEditFromDetail() {
  if (!canEditFromDetail.value || !formData.value) return;
  const warehouse = { ...formData.value };
  await modalApi.close();
  emit('edit', warehouse);
}

const [Modal, modalApi] = useVbenModal({
  onOpened() {
    modalOpened = true;
    queueInitialFocus();
  },
  async onConfirm() {
    if (
      submitInFlight.value ||
      !canSubmit.value ||
      !hasAccessByCodes([
        formData.value?.id ? 'erp:warehouse:update' : 'erp:warehouse:create',
      ])
    )
      return;
    const sequence = dataLoadSequence;
    const existingId = formData.value?.id;
    submitInFlight.value = true;
    modalApi.lock();
    try {
      const [baseValidate, locationValidate] = await Promise.all([
        formApi.validate(),
        locationFormApi.validate(),
      ]);
      if (
        !baseValidate.valid ||
        !locationValidate.valid ||
        sequence !== dataLoadSequence
      )
        return;
      const [baseValues, locationValues] = await Promise.all([
        formApi.getValues(),
        locationFormApi.getValues(),
      ]);
      if (sequence !== dataLoadSequence) return;
      const data = normalizeWarehouseManualCode({
        ...baseValues,
        ...locationValues,
      } as ErpWarehouseApi.Warehouse & Record<string, any>);
      let id = existingId;
      if (existingId) await updateWarehouse({ ...data, id: existingId });
      else id = await createWarehouse(data);
      if (sequence !== dataLoadSequence) return;
      await modalApi.close();
      emit('success', { ...data, id });
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      submitInFlight.value = false;
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      dataLoadSequence += 1;
      modalOpened = false;
      initialFocusDone = false;
      dataLoading.value = false;
      dataLoadError.value = '';
      formData.value = undefined;
      formType.value = 'create';
      activeTabKey.value = 'base';
      formApi.setDisabled(false);
      locationFormApi.setDisabled(false);
      return;
    }
    modalApi.setState({ fullscreen: true });
    // 加载数据
    const data = modalApi.getData<
      ErpWarehouseApi.Warehouse & { type?: 'create' | 'detail' | 'edit' }
    >();
    formType.value = data?.type || (data?.id ? 'edit' : 'create');
    activeTabKey.value = 'base';
    dataLoadError.value = '';
    dataLoading.value = true;
    formData.value = data?.id ? { ...data } : undefined;
    const sequence = ++dataLoadSequence;
    try {
      const [deptList, cloudPrintDeviceList] = await Promise.all([
        Promise.resolve([] as SystemDeptApi.Dept[]),
        getCloudPrintDeviceOptions(),
        loadHiddenFields(),
      ]);
      if (sequence !== dataLoadSequence) {
        return;
      }
      deptOptions.value = deptList;
      cloudPrintDeviceOptions.value = cloudPrintDeviceList;
      formApi.setDisabled(isReadonly.value);
      locationFormApi.setDisabled(isReadonly.value);
      formApi.setState({
        schema: withCandidateFocus(
          useFormSchema(
            hiddenFields.value,
            deptOptions.value,
            cloudPrintDeviceOptions.value,
            formType.value,
            formData.value,
          ),
        ),
      });
      locationFormApi.setState({
        schema: withCandidateFocus(useLocationFormSchema(hiddenFields.value)),
      });
      await nextTick();
      if (sequence !== dataLoadSequence) return;
      await Promise.all([formApi.resetForm(), locationFormApi.resetForm()]);
      if (sequence !== dataLoadSequence) return;
      if (!data || !data.id) {
        formData.value = {
          deptId: normalizeDeptId(userStore.userInfo?.deptId),
          manualInputCode: false,
          warehouseCode: undefined,
        } as ErpWarehouseApi.Warehouse;
        await Promise.all([
          formApi.setValues(formData.value),
          locationFormApi.setValues(formData.value),
        ]);
        if (sequence !== dataLoadSequence) return;
        if (formData.value.deptId) {
          // Only resolve the current department for its label; candidates load on demand.
          const deptPage = await getWarehouseFormDeptSimplePage({
            pageNo: 1,
            pageSize: 1,
            selectedId: formData.value.deptId,
          });
          const dept = deptPage.list[0];
          if (sequence !== dataLoadSequence) return;
          if (dept) {
            deptOptions.value = [dept];
            await formApi.updateSchema([
              {
                fieldName: 'deptId',
                componentProps: {
                  options: [{ label: dept.name, value: dept.id }],
                },
              },
            ]);
          }
        }
        return;
      }
      const warehouse = await getWarehouse(data.id);
      if (sequence !== dataLoadSequence) {
        return;
      }
      formData.value = warehouse;
      formData.value.deptId = normalizeDeptId(formData.value.deptId);
      formApi.setState({
        schema: withCandidateFocus(
          useFormSchema(
            hiddenFields.value,
            deptOptions.value,
            cloudPrintDeviceOptions.value,
            formType.value,
            formData.value,
          ),
        ),
      });
      locationFormApi.setState({
        schema: withCandidateFocus(useLocationFormSchema(hiddenFields.value)),
      });
      await nextTick();
      if (sequence !== dataLoadSequence) return;
      formApi.setDisabled(isReadonly.value);
      locationFormApi.setDisabled(isReadonly.value);
      // 设置到 values
      await Promise.all([
        formApi.setValues(formData.value),
        locationFormApi.setValues(formData.value),
      ]);
    } catch {
      if (sequence === dataLoadSequence) {
        formData.value = undefined;
        dataLoadError.value = '仓库信息加载失败，请关闭后重试';
      }
    } finally {
      if (sequence === dataLoadSequence) {
        dataLoading.value = false;
        await nextTick();
        queueInitialFocus();
      }
    }
  },
});
</script>

<template>
  <Modal
    :title="getTitle"
    class="!w-full"
    bordered
    content-class="p-0"
    :show-confirm-button="canSubmit"
  >
    <div
      ref="formScope"
      class="erp-form-focus-highlight warehouse-form-scope"
      @keydown.enter.capture="handleFormEnter"
    >
      <Tabs v-model:active-key="activeTabKey" class="warehouse-form-tabs">
        <Tabs.TabPane key="base" tab="基础信息">
          <div class="warehouse-form-view">
            <div v-if="dataLoading" class="warehouse-form-load-state">
              正在加载仓库信息，请稍候…
            </div>
            <div
              v-else-if="dataLoadError"
              class="warehouse-form-load-state is-error"
            >
              {{ dataLoadError }}
            </div>
            <!--
            表单必须在 loading 期间保持挂载：初始化流程会调用 formApi，
            若使用 v-if 卸载 Form，会造成 resetForm 等待挂载与 loading 等待
            resetForm 完成的循环等待。
          -->
            <section
              v-show="!dataLoading && !dataLoadError"
              class="warehouse-form-section"
            >
              <header class="warehouse-form-section__header">
                <span class="warehouse-form-section__title">基本信息</span>
              </header>
              <p class="mb-2 text-gray-500">
                新业务审核后直接增减库存；历史领货设置仅供查询，不再控制新业务。
              </p>
              <Form
                class="warehouse-edit-form"
                :class="{
                  'warehouse-edit-form--editable': !isReadonly,
                  'warehouse-edit-form--readonly': isReadonly,
                }"
              />
            </section>

            <section
              v-if="showLocationSection"
              v-show="!dataLoading && !dataLoadError"
              class="warehouse-form-section"
            >
              <header class="warehouse-form-section__header">
                <span class="warehouse-form-section__title">位置信息</span>
              </header>
              <LocationForm
                class="warehouse-edit-form"
                :class="{
                  'warehouse-edit-form--editable': !isReadonly,
                  'warehouse-edit-form--readonly': isReadonly,
                }"
              />
            </section>

            <section
              v-if="formData?.id"
              v-show="!dataLoading && !dataLoadError"
              class="warehouse-form-section warehouse-form-audit"
            >
              <header class="warehouse-form-section__header">
                <span class="warehouse-form-section__title">审计信息</span>
              </header>
              <ErpAuditInfo title="" :record="formData" />
            </section>
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane
          v-if="showPermissionTab"
          key="saleDeptPermission"
          tab="权限分发"
        >
          <div class="warehouse-form-view">
            <section class="warehouse-form-section">
              <header class="warehouse-form-section__header">
                <span class="warehouse-form-section__title">权限分发</span>
              </header>
              <SaleDeptPermission
                class="warehouse-permission-panel"
                :detail="isReadonly"
                :warehouse="formData"
              />
            </section>
          </div>
        </Tabs.TabPane>
      </Tabs>
    </div>
    <template #cancelText>
      {{ isReadonly ? '关闭' : '取消' }}
    </template>
    <template #prepend-footer>
      <Button
        v-if="canEditFromDetail"
        type="primary"
        @click="handleEditFromDetail"
      >
        编辑
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.warehouse-form-tabs :deep(.ant-tabs-nav) {
  margin: 0;
  padding: 0 12px;
  background: hsl(var(--card));
}

.warehouse-form-tabs :deep(.ant-tabs-tab) {
  padding: 10px 0;
  font-size: 12px;
}

.warehouse-form-view {
  display: flex;
  min-height: calc(100vh - 190px);
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  overflow: auto;
  background: hsl(var(--muted) / 28%);
  font-size: 12px;
}

.warehouse-form-load-state {
  display: flex;
  min-height: 96px;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.warehouse-form-load-state.is-error {
  color: hsl(var(--destructive));
}

.warehouse-form-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.warehouse-form-section__header {
  display: flex;
  min-height: 40px;
  align-items: center;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.warehouse-form-section__title {
  position: relative;
  padding-left: 10px;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.warehouse-form-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  background: hsl(var(--primary));
  border-radius: 3px;
  content: '';
}

.warehouse-edit-form :deep(.warehouse-basic-grid),
.warehouse-edit-form :deep(.warehouse-location-grid) {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0 12px;
  padding: 12px;
}

.warehouse-edit-form :deep(.warehouse-basic-grid > div),
.warehouse-edit-form :deep(.warehouse-location-grid > div) {
  min-width: 0;
}

.warehouse-edit-form :deep(.warehouse-basic-grid > div > label),
.warehouse-edit-form :deep(.warehouse-location-grid > div > label) {
  margin-right: 0;
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
}

.warehouse-edit-form :deep(.warehouse-basic-grid > div > .flex-auto),
.warehouse-edit-form :deep(.warehouse-location-grid > div > .flex-auto) {
  min-width: 0;
}

.warehouse-edit-form :deep(.ant-input),
.warehouse-edit-form :deep(.ant-input-affix-wrapper),
.warehouse-edit-form :deep(.ant-input-number),
.warehouse-edit-form :deep(.ant-select-selector),
.warehouse-edit-form :deep(.ant-radio-button-wrapper) {
  min-height: 32px;
  background: hsl(var(--muted) / 48%);
  border-color: hsl(var(--border));
  border-radius: 6px !important;
  font-size: 12px;
}

.warehouse-edit-form :deep(.ant-input),
.warehouse-edit-form :deep(.ant-input-number-input),
.warehouse-edit-form :deep(.ant-select-selection-item),
.warehouse-edit-form :deep(.ant-select-selection-placeholder),
.warehouse-edit-form :deep(.ant-radio-wrapper),
.warehouse-edit-form :deep(.ant-radio-button-wrapper),
.warehouse-edit-form :deep(.ant-checkbox-wrapper),
.warehouse-edit-form :deep(.ant-switch) {
  font-size: 12px;
}

.warehouse-edit-form :deep(.ant-input:not(textarea)),
.warehouse-edit-form :deep(.ant-input-affix-wrapper),
.warehouse-edit-form :deep(.ant-input-number),
.warehouse-edit-form :deep(.ant-select-single),
.warehouse-edit-form :deep(.ant-radio-button-wrapper) {
  height: 32px;
}

.warehouse-edit-form :deep(.ant-input-number) {
  width: 100%;
}

.warehouse-edit-form :deep(.ant-input-affix-wrapper > input.ant-input) {
  background: transparent !important;
}

.warehouse-edit-form :deep(textarea) {
  min-height: 32px !important;
  resize: none;
  white-space: nowrap;
}

.warehouse-edit-form--editable :deep(.ant-input:not(:disabled)),
.warehouse-edit-form--editable
  :deep(.ant-input-affix-wrapper:not(.ant-input-affix-wrapper-disabled)),
.warehouse-edit-form--editable
  :deep(.ant-input-number:not(.ant-input-number-disabled)),
.warehouse-edit-form--editable
  :deep(.ant-select:not(.ant-select-disabled) .ant-select-selector),
.warehouse-edit-form--editable
  :deep(.ant-radio-button-wrapper:not(.ant-radio-button-wrapper-disabled)) {
  background: hsl(var(--background));
}

.warehouse-edit-form--editable :deep(.ant-input:disabled),
.warehouse-edit-form--editable :deep(.ant-input-affix-wrapper-disabled),
.warehouse-edit-form--editable :deep(.ant-input-number-disabled),
.warehouse-edit-form--editable :deep(.ant-select-disabled .ant-select-selector),
.warehouse-edit-form--readonly :deep(.ant-input),
.warehouse-edit-form--readonly :deep(.ant-input-affix-wrapper),
.warehouse-edit-form--readonly :deep(.ant-input-number),
.warehouse-edit-form--readonly :deep(.ant-select-selector),
.warehouse-edit-form--readonly :deep(.ant-radio-button-wrapper) {
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

.warehouse-edit-form :deep(.ant-switch-disabled),
.warehouse-edit-form :deep(.ant-checkbox-wrapper-disabled) {
  cursor: not-allowed;
  opacity: 0.72;
}

.warehouse-form-audit :deep(.erp-audit-info) {
  padding: 12px;
}

.warehouse-form-audit :deep(.erp-audit-info .text-sm) {
  font-size: 12px;
}

.warehouse-form-audit :deep(.erp-audit-info > div:first-child) {
  display: none;
}

:global(.warehouse-form-select-dropdown .ant-select-item),
:global(.warehouse-form-select-dropdown .ant-empty-description),
:global(.warehouse-select-dropdown .ant-select-item),
:global(.warehouse-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

@media (max-width: 1279px) {
  .warehouse-edit-form :deep(.warehouse-basic-grid),
  .warehouse-edit-form :deep(.warehouse-location-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .warehouse-form-view {
    padding: 8px;
  }

  .warehouse-edit-form :deep(.warehouse-basic-grid),
  .warehouse-edit-form :deep(.warehouse-location-grid) {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
