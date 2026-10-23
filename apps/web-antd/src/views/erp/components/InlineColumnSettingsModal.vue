<script setup lang="ts">
import type {
  InlineColumn,
  InlineColumnPreference,
} from '../composables/useInlineColumnSettings';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import {
  Button,
  Checkbox,
  InputNumber,
  Modal,
  RadioButton,
  RadioGroup,
} from 'ant-design-vue';
import Sortable from 'sortablejs';

import {
  defaultColumns,
  validateColumns,
} from '../composables/useInlineColumnSettings';

const props = defineProps<{
  columns: InlineColumn[];
  panelWidth: () => number;
  value: InlineColumnPreference[];
}>();
const emit = defineEmits<{
  closed: [];
  confirm: [columns: InlineColumnPreference[]];
}>();
const visible = ref(true);
const draft = ref(props.value.map((column) => ({ ...column })));
const error = ref('');
const body = ref<HTMLElement>();
const allVisible = computed(() =>
  draft.value.every((column) => column.visible),
);
const someVisible = computed(() =>
  draft.value.some((column) => column.visible),
);
const titles = new Map(
  props.columns.map((column) => [column.field, column.title]),
);
let sortable: Sortable | undefined;
watch(
  body,
  (element) => {
    sortable?.destroy();
    sortable = undefined;
    if (!element) return;
    sortable = Sortable.create(element, {
      handle: '.inline-column-drag',
      animation: 150,
      onEnd({ item, oldIndex, newIndex }) {
        if (
          oldIndex === undefined ||
          newIndex === undefined ||
          oldIndex === newIndex
        )
          return;
        // Restore the DOM before Vue applies the reordered keyed array.
        item.remove();
        element.insertBefore(item, element.children[oldIndex] ?? null);
        const next = [...draft.value];
        const moved = next.splice(oldIndex, 1)[0];
        if (moved) next.splice(newIndex, 0, moved);
        draft.value = next;
      },
    });
  },
  { flush: 'post' },
);
onBeforeUnmount(() => sortable?.destroy());
function confirm() {
  error.value = validateColumns(draft.value, props.panelWidth());
  if (error.value) return;
  emit(
    'confirm',
    draft.value.map((column) => ({ ...column })),
  );
  visible.value = false;
}
function reset() {
  draft.value = defaultColumns(props.columns);
  error.value = '';
}
function handleKeydown(event: KeyboardEvent) {
  event.stopPropagation();
  if (event.key === 'Escape' && !event.isComposing) {
    event.preventDefault();
    visible.value = false;
  }
}

function cancel(event: Event) {
  event.stopPropagation();
  visible.value = false;
}
</script>

<template>
  <Modal
    :open="visible"
    :after-close="() => emit('closed')"
    title="列设置"
    :width="960"
    :z-index="3000"
    :mask-closable="false"
    :keyboard="false"
    :focus-trigger-after-close="false"
    wrap-class-name="inline-column-settings-modal"
    @cancel="cancel"
  >
    <template #modalRender="{ originVNode }">
      <div
        @mousedown.stop
        @touchstart.stop
        @click.stop
        @keydown="handleKeydown"
      >
        <component :is="originVNode" />
      </div>
    </template>
    <div @keydown="handleKeydown" @click.stop>
      <div class="inline-column-settings-scroll">
        <table class="inline-column-settings-table">
          <thead>
            <tr>
              <th class="inline-column-check">
                <Checkbox
                  :checked="allVisible"
                  :indeterminate="someVisible && !allVisible"
                  @change="
                    (event) =>
                      draft.forEach(
                        (column) => (column.visible = event.target.checked),
                      )
                  "
                >
                  全部
                </Checkbox>
              </th>
              <th>列标题</th>
              <th>列宽（像素）</th>
              <th>冻结列（最多 4 列）</th>
            </tr>
          </thead>
          <tbody ref="body">
            <tr
              v-for="column in draft"
              :key="column.field"
              :data-field="column.field"
            >
              <td class="inline-column-check">
                <Checkbox
                  v-model:checked="column.visible"
                  :aria-label="`显示${titles.get(column.field)}`"
                />
              </td>
              <td>
                <span class="inline-column-drag" title="拖动调整顺序">⠿</span
                >{{ titles.get(column.field) }}
              </td>
              <td>
                <InputNumber
                  v-model:value="column.width"
                  :min="60"
                  :max="600"
                  :step="1"
                  :aria-label="`${titles.get(column.field)}列宽`"
                />
              </td>
              <td>
                <RadioGroup
                  v-model:value="column.fixed"
                  size="small"
                  :aria-label="`${titles.get(column.field)}冻结位置`"
                >
                  <RadioButton value="left">左侧</RadioButton
                  ><RadioButton value="">不设置</RadioButton
                  ><RadioButton value="right">右侧</RadioButton>
                </RadioGroup>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="error" role="alert" class="inline-column-error">{{ error }}</p>
    </div>
    <template #footer>
      <div @keydown="handleKeydown" @click.stop>
        <Button @click="reset">恢复默认</Button>
        <Button @click="visible = false">取消</Button>
        <Button type="primary" @click="confirm">确定</Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.inline-column-settings-scroll {
  max-height: 60vh;
  overflow: auto;
}
.inline-column-settings-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
.inline-column-settings-table th,
.inline-column-settings-table td {
  padding: 10px;
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}
.inline-column-settings-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f8fafc;
  text-align: left;
}
.inline-column-check {
  width: 85px;
  text-align: center !important;
}
.inline-column-drag {
  display: inline-block;
  padding: 0 12px;
  cursor: grab;
  font-size: 20px;
}
.inline-column-error {
  margin: 12px 0 0;
  color: #cf1322;
}
</style>
