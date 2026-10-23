<script lang="ts" setup>
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    navigable?: boolean;
    value?: null | number | string;
  }>(),
  {
    navigable: false,
    value: undefined,
  },
);

const emit = defineEmits<{
  open: [];
}>();

const displayValue = computed(() =>
  props.value === null || props.value === undefined || props.value === ''
    ? '-'
    : props.value,
);

function handleOpen() {
  if (!props.navigable) return;
  emit('open');
}
</script>

<template>
  <a
    class="erp-detail-link-field relative grid w-full min-w-max"
    :class="{ 'cursor-pointer': navigable }"
    :role="navigable ? 'link' : undefined"
    :tabindex="navigable ? 0 : undefined"
    @click.stop="handleOpen"
    @keydown.enter.stop="handleOpen"
  >
    <span
      aria-hidden="true"
      class="invisible col-start-1 row-start-1 whitespace-nowrap px-3"
    >
      {{ displayValue }}
    </span>
    <a-input
      :value="displayValue"
      disabled
      class="col-start-1 row-start-1 w-full"
      :class="{
        'pointer-events-none !cursor-pointer !text-primary': navigable,
      }"
    />
    <span
      v-if="navigable"
      aria-hidden="true"
      class="absolute inset-0 cursor-pointer"
    ></span>
  </a>
</template>
