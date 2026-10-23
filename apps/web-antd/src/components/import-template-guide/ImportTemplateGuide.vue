<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import { Tag } from 'ant-design-vue';

interface ImportTemplateField {
  example?: string;
  name: string;
  required?: boolean;
  rule: string;
}

withDefaults(
  defineProps<{
    fields?: ImportTemplateField[];
    summary: string;
    tips?: string[];
    title?: string;
  }>(),
  {
    fields: () => [],
    tips: () => [],
    title: '导入格式说明',
  },
);

const commonRules = [
  '请先下载导入模板，并保留模板中的表头名称和列顺序。',
  '从模板的数据行开始填写，示例行可删除后再导入。',
  '仅支持 .xls / .xlsx 文件，日期、金额、数量请按模板示例填写。',
];
</script>

<template>
  <section class="rounded-md border border-border bg-muted/30 p-3 text-sm">
    <div class="mb-2 flex items-center gap-2 font-medium text-foreground">
      <IconifyIcon class="text-primary" icon="lucide:file-spreadsheet" />
      <span>{{ title }}</span>
    </div>
    <p class="mb-3 leading-6 text-muted-foreground">{{ summary }}</p>

    <div class="import-template-guide__rules grid gap-2">
      <div
        v-for="rule in commonRules"
        :key="rule"
        class="rounded border border-dashed border-border bg-background px-3 py-2 text-xs leading-5 text-muted-foreground"
      >
        {{ rule }}
      </div>
    </div>

    <div v-if="fields.length > 0" class="mt-3 overflow-hidden rounded border">
      <table class="w-full table-fixed text-xs">
        <thead class="bg-background text-muted-foreground">
          <tr>
            <th class="w-1/5 px-3 py-2 text-left font-medium">字段</th>
            <th class="w-16 px-3 py-2 text-left font-medium">必填</th>
            <th class="px-3 py-2 text-left font-medium">填写规则</th>
            <th class="w-1/4 px-3 py-2 text-left font-medium">示例</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border bg-background/70">
          <tr v-for="field in fields" :key="field.name">
            <td class="px-3 py-2 font-medium text-foreground">
              {{ field.name }}
            </td>
            <td class="px-3 py-2">
              <Tag :color="field.required ? 'red' : 'default'">
                {{ field.required ? '必填' : '选填' }}
              </Tag>
            </td>
            <td class="px-3 py-2 leading-5 text-muted-foreground">
              {{ field.rule }}
            </td>
            <td class="px-3 py-2 text-muted-foreground">
              {{ field.example || '-' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ul v-if="tips.length > 0" class="mb-0 mt-3 space-y-1 pl-4 text-xs">
      <li
        v-for="tip in tips"
        :key="tip"
        class="leading-5 text-muted-foreground"
      >
        {{ tip }}
      </li>
    </ul>
  </section>
</template>

<style scoped>
.import-template-guide__rules {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}
</style>
