<script lang="ts" setup>
interface Props {
  editable?: boolean;
  error?: string;
  itemTitle?: string;
  loading?: boolean;
}

withDefaults(defineProps<Props>(), {
  editable: false,
  error: '',
  itemTitle: '产品明细',
  loading: false,
});
</script>

<template>
  <div class="stock-document-form-view">
    <div v-if="loading" class="stock-document-form-load-state">
      正在加载单据信息，请稍候…
    </div>
    <div
      v-else-if="error"
      class="stock-document-form-load-state stock-document-form-load-state--error"
    >
      {{ error }}
    </div>

    <!--
      内容使用 v-show 保持挂载，避免 loading 分支卸载 Form / Grid 后，
      formApi 或 gridApi 的初始化调用与组件挂载互相等待。
    -->
    <div v-show="!loading && !error" class="stock-document-form-content">
      <section class="stock-document-form-section">
        <header class="stock-document-form-section__header">
          <span class="stock-document-form-section__title">基本信息</span>
        </header>
        <div
          class="stock-document-edit-form"
          :class="
            editable
              ? 'stock-document-edit-form--editable'
              : 'stock-document-edit-form--readonly'
          "
        >
          <slot name="basic"></slot>
        </div>
      </section>

      <section v-if="$slots.items" class="stock-document-form-section">
        <header class="stock-document-form-section__header">
          <span class="stock-document-form-section__title">{{
            itemTitle
          }}</span>
        </header>
        <div class="stock-document-item-form">
          <slot name="items"></slot>
        </div>
      </section>

      <section
        v-if="$slots.audit"
        class="stock-document-form-section stock-document-form-audit"
      >
        <header class="stock-document-form-section__header">
          <span class="stock-document-form-section__title">审计信息</span>
        </header>
        <slot name="audit"></slot>
      </section>
    </div>
  </div>
</template>

<style>
.stock-document-form-view {
  min-height: calc(100vh - 118px);
  padding: 12px;
  overflow: auto;
  font-size: 12px;
  background: hsl(var(--muted) / 28%);
}

.stock-document-form-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stock-document-form-load-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.stock-document-form-load-state--error {
  color: hsl(var(--destructive));
}

.stock-document-form-section {
  min-width: 0;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.stock-document-form-section__header {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.stock-document-form-section__title {
  position: relative;
  padding-left: 10px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.stock-document-form-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 3px;
}

.stock-document-edit-form .stock-document-basic-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0 12px;
  padding: 12px;
}

.stock-document-edit-form .stock-document-basic-grid > div {
  min-width: 0;
}

.stock-document-edit-form .stock-document-basic-grid > div > label {
  padding-right: 10px;
  margin-right: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.stock-document-edit-form .stock-document-basic-grid > div > .flex-auto {
  min-width: 0;
}

.stock-document-readonly-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 12px;
  padding: 12px;
}

.stock-document-readonly-field {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  align-items: center;
  min-width: 0;
  min-height: 32px;
}

.stock-document-readonly-field__label {
  padding-right: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.stock-document-readonly-field__value {
  min-width: 0;
  min-height: 32px;
  padding: 5px 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  line-height: 20px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  background: hsl(var(--muted-foreground) / 14%);
  border: 1px solid hsl(var(--muted-foreground) / 28%);
  border-radius: 6px;
}

button.stock-document-readonly-field__value--link {
  width: 100%;
  color: hsl(var(--primary));
  text-align: left;
  cursor: pointer;
}

button.stock-document-readonly-field__value--link:hover {
  border-color: hsl(var(--primary));
}

.stock-document-edit-form .ant-input,
.stock-document-edit-form .ant-input-affix-wrapper,
.stock-document-edit-form .ant-input-number,
.stock-document-edit-form .ant-picker,
.stock-document-edit-form .ant-select-selector,
.stock-document-edit-form .ant-radio-button-wrapper,
.stock-document-edit-form .ant-upload-select {
  min-height: 32px;
  font-size: 12px;
  background: hsl(var(--muted) / 48%) !important;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
}

.stock-document-edit-form .ant-input,
.stock-document-edit-form .ant-input-number-input,
.stock-document-edit-form .ant-picker-input > input,
.stock-document-edit-form .ant-select-selection-item,
.stock-document-edit-form .ant-select-selection-placeholder,
.stock-document-edit-form .ant-radio-wrapper,
.stock-document-edit-form .ant-radio-button-wrapper,
.stock-document-edit-form .ant-checkbox-wrapper,
.stock-document-edit-form .ant-switch,
.stock-document-edit-form .ant-upload {
  font-size: 12px;
}

.stock-document-edit-form .ant-input:not(textarea),
.stock-document-edit-form .ant-input-affix-wrapper,
.stock-document-edit-form .ant-input-number,
.stock-document-edit-form .ant-picker,
.stock-document-edit-form .ant-select-single,
.stock-document-edit-form .ant-radio-button-wrapper {
  height: 32px;
}

.stock-document-edit-form .ant-input-number,
.stock-document-edit-form .ant-picker {
  width: 100%;
}

.stock-document-edit-form .ant-input-affix-wrapper > input.ant-input {
  background: transparent !important;
}

.stock-document-edit-form--readonly
  .stock-document-form-readonly-text.ant-input-affix-wrapper {
  align-items: center;
  padding-block: 0;
}

.stock-document-edit-form--readonly
  .stock-document-form-readonly-text.ant-input-affix-wrapper
  > input.ant-input {
  height: 30px;
  padding-block: 0;
  line-height: 30px;
}

.stock-document-edit-form textarea.ant-input {
  min-height: 32px !important;
  resize: none;
}

.stock-document-edit-form--editable .ant-input:not(:disabled),
.stock-document-edit-form--editable
  .ant-input-affix-wrapper:not(.ant-input-affix-wrapper-disabled),
.stock-document-edit-form--editable
  .ant-input-number:not(.ant-input-number-disabled),
.stock-document-edit-form--editable .ant-picker:not(.ant-picker-disabled),
.stock-document-edit-form--editable
  .ant-select:not(.ant-select-disabled)
  .ant-select-selector,
.stock-document-edit-form--editable
  .ant-radio-button-wrapper:not(.ant-radio-button-wrapper-disabled),
.stock-document-edit-form--editable
  .ant-upload-wrapper
  .ant-upload-select:not(.ant-upload-disabled) {
  background: hsl(var(--background)) !important;
}

.stock-document-edit-form--editable .ant-input:disabled,
.stock-document-edit-form--editable .ant-input-affix-wrapper-disabled,
.stock-document-edit-form--editable .ant-input-number-disabled,
.stock-document-edit-form--editable .ant-picker-disabled,
.stock-document-edit-form--editable .ant-select-disabled .ant-select-selector,
.stock-document-edit-form--readonly .ant-input,
.stock-document-edit-form--readonly .ant-input-affix-wrapper,
.stock-document-edit-form--readonly .ant-input-number,
.stock-document-edit-form--readonly .ant-picker,
.stock-document-edit-form--readonly .ant-select-selector,
.stock-document-edit-form--readonly .ant-radio-button-wrapper,
.stock-document-edit-form--readonly .ant-upload-select {
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

.stock-document-edit-form .ant-switch-disabled,
.stock-document-edit-form .ant-checkbox-wrapper-disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.stock-document-item-form {
  min-width: 0;
  padding: 12px;
  font-size: 11px;
}

.stock-document-item-form .vxe-table,
.stock-document-item-form .vxe-table--render-default,
.stock-document-item-form .vxe-cell,
.stock-document-item-form .ant-input,
.stock-document-item-form .ant-input-number-input,
.stock-document-item-form .ant-select-selection-item,
.stock-document-item-form .ant-select-selection-placeholder,
.stock-document-item-form .ant-select-item,
.stock-document-item-form .ant-btn,
.stock-document-item-form .text-sm {
  font-size: 11px;
}

.stock-document-item-form .ant-input,
.stock-document-item-form .ant-input-number,
.stock-document-item-form .ant-select-single,
.stock-document-item-form .ant-select-selector {
  min-height: 28px;
}

.stock-document-item-form .ant-btn {
  min-height: 28px;
  padding: 0 10px;
}

.stock-document-form-audit .erp-audit-info {
  padding: 12px;
}

.stock-document-form-audit .erp-audit-info .text-sm {
  font-size: 12px;
}

.stock-document-form-audit .erp-audit-info > div:first-child {
  display: none;
}

.stock-document-form-select-dropdown .ant-select-item,
.stock-document-form-select-dropdown .ant-select-tree,
.stock-document-form-select-dropdown .ant-empty-description {
  font-size: 12px;
}

@media (max-width: 1279px) {
  .stock-document-edit-form .stock-document-basic-grid,
  .stock-document-readonly-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .stock-document-form-view {
    padding: 8px;
  }

  .stock-document-edit-form .stock-document-basic-grid,
  .stock-document-readonly-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
