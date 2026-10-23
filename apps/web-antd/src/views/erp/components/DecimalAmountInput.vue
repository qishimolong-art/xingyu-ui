<script setup lang="ts">
import { computed, ref } from 'vue';
import { Input } from 'ant-design-vue';
import { financeMoney } from '../finance/utils/finance-decimal';
defineOptions({ inheritAttrs: false });
const props = defineProps<{ value?: null | number | string }>();
const emit = defineEmits<{
  'update:value': [value: string];
  input: [event: Event];
  blur: [event: FocusEvent];
  focus: [event: FocusEvent];
}>();
const editing = ref(false);
const inputRef = ref();
const display = computed(() => {
  const text = props.value == null ? '' : String(props.value);
  return editing.value || !/^-?\d+(?:\.\d*)?$/.test(text)
    ? text
    : financeMoney(text, '');
});
function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!/^-?\d*(?:\.\d*)?$/.test(target.value)) {
    target.value = display.value;
    return;
  }
  emit('update:value', target.value);
  emit('input', event);
}
defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
});
</script>
<template>
  <Input
    ref="inputRef"
    v-bind="$attrs"
    type="text"
    inputmode="decimal"
    :value="display"
    @input="onInput"
    @focus="
      editing = true;
      emit('focus', $event);
    "
    @blur="
      editing = false;
      emit('blur', $event);
    "
  />
</template>
