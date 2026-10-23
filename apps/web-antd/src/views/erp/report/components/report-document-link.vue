<script setup lang="ts">
defineProps<{ value?: null | string }>();
const emit = defineEmits<{ open: [] }>();
</script>

<template>
  <button
    v-if="value?.trim()"
    type="button"
    class="report-document-link"
    :title="value"
    @click.stop="emit('open')"
  >
    {{ value }}
  </button>
  <span v-else>-</span>
</template>

<style scoped>
.report-document-link {
  display: block;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  color: #1677ff;
  font: inherit;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}
.report-document-link:hover {
  color: #4096ff;
  text-decoration: underline;
}
.report-document-link:focus-visible {
  outline: 2px solid #1677ff;
  outline-offset: 2px;
}
</style>
