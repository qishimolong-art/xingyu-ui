<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Page } from '@vben/common-ui';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  Input,
  message,
  Select,
  Switch,
  Table,
  TabPane,
  Tabs,
} from 'ant-design-vue';
import type {
  Choices,
  RuleConfig,
  Template,
} from '#/api/erp/finance/accounting/voucher-rule';
import {
  getRuleChoices,
  getRuleConfig,
  getRuleTemplates,
  ROLE_LABELS,
  saveRuleConfig,
  setRuleEnabled,
} from '#/api/erp/finance/accounting/voucher-rule';
const config = ref<RuleConfig>({
  version: 0,
  taxpayer: 'UNSET',
  enabledScenarios: [],
  mappings: [],
  accounts: [],
  projects: [],
});
const choices = ref<Choices>({
  subjects: [],
  categories: [],
  accounts: [],
  departments: [],
});
const templates = ref<Template[]>([]);
const active = ref('PURCHASE');
const busy = ref(false);
const current = computed(() =>
  templates.value.find((t) => t.code === active.value),
);
const subjectOptions = computed(() =>
  choices.value.subjects.map((s) => ({
    value: s.id,
    label: `${s.subjectCode} ${s.subjectName}`,
  })),
);
const categoryOptions = computed(() =>
  choices.value.categories.map((c) => ({ value: c.id, label: c.name })),
);
const accountOptions = computed(() =>
  choices.value.accounts.map((a) => ({ value: a.id, label: a.name })),
);
const deptOptions = computed(() =>
  choices.value.departments.map((d) => ({ value: d.id!, label: d.name })),
);
const mappings = computed(() =>
  config.value.mappings.filter((m) => m.scenario === active.value),
);
function projectDepartments(ids: number[]) {
  return [
    ...deptOptions.value,
    ...ids
      .filter((id) => !deptOptions.value.some((d) => d.value === id))
      .map((id) => ({
        value: id,
        label: `部门 ${id}（无权限或已停用）`,
        disabled: true,
      })),
  ];
}
function selectProjectDepartments(
  project: RuleConfig['projects'][number],
  checked: boolean,
) {
  const unavailable = project.deptIds.filter(
    (id) => !deptOptions.value.some((d) => d.value === id),
  );
  project.deptIds = [
    ...unavailable,
    ...(checked ? deptOptions.value.map((d) => d.value) : []),
  ];
}
async function load() {
  busy.value = true;
  try {
    [config.value, choices.value, templates.value] = await Promise.all([
      getRuleConfig(),
      getRuleChoices(),
      getRuleTemplates(),
    ]);
  } finally {
    busy.value = false;
  }
}
function addDefaults() {
  for (const role of (current.value?.roles ?? []).filter(
    (role) => !(config.value.taxpayer === 'SMALL' && role === 'INPUT_TAX'),
  ))
    if (!mappings.value.some((m) => m.role === role && !m.categoryId))
      config.value.mappings.push({ scenario: active.value, role });
}
async function pauseCurrent() {
  busy.value = true;
  try {
    await setRuleEnabled({
      scenario: active.value,
      enabled: false,
      version: config.value.version,
    });
    config.value = await getRuleConfig();
    message.success('当前模板已暂停');
  } finally {
    busy.value = false;
  }
}
async function save() {
  busy.value = true;
  try {
    await saveRuleConfig(config.value);
    config.value = await getRuleConfig();
    message.success('规则已保存，仅影响后续生成');
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <Page auto-content-height>
    <Card title="凭证生成规则" :loading="busy">
      <template #extra
        ><Button
          v-access:code="['erp:voucher-rule:update']"
          type="primary"
          :loading="busy"
          @click="save"
          >保存配置</Button
        ><Button class="ml-2" @click="load">刷新</Button></template
      >
      <Alert
        class="mb-4"
        type="info"
        show-icon
        message="小企业会计准则 · 汽配批发零售"
        description="先配置末级科目和结算账户，再启用业务模板。规则修改不会重算历史凭证；借贷方向及金额公式由系统维护。"
      />
      <Tabs>
        <TabPane key="basic" tab="基本设置">
          <div class="mb-4">
            纳税身份
            <Select
              v-model:value="config.taxpayer"
              class="ml-3 w-64"
              :options="[
                { value: 'UNSET', label: '未配置' },
                { value: 'GENERAL', label: '一般纳税人' },
                { value: 'SMALL', label: '小规模纳税人' },
              ]"
            />
          </div>
          <p class="mb-3">
            启用模板（涉税模板需先确定纳税身份，所有模板需完整默认科目）
          </p>
          <CheckboxGroup
            v-model:value="config.enabledScenarios"
            class="grid grid-cols-3 gap-3"
          >
            <Checkbox
              v-for="t in templates"
              :key="t.code"
              :value="t.code"
              :disabled="t.taxable && config.taxpayer === 'UNSET'"
              >{{ t.name }}</Checkbox
            >
          </CheckboxGroup>
          <p class="mt-4 text-gray-500">
            配置版本：{{
              config.version
            }}。未知税额、库存差额及暂估后续调整在生成页明确提示，不自动补平。
          </p>
        </TabPane>
        <TabPane key="subjects" tab="业务科目及类别覆盖">
          <Select
            v-model:value="active"
            class="mb-4 w-80"
            :options="templates.map((t) => ({ value: t.code, label: t.name }))"
          />
          <Button
            v-access:code="['erp:voucher-rule:update']"
            class="mb-3 ml-3"
            danger
            :disabled="!config.enabledScenarios.includes(active)"
            @click="pauseCurrent"
            >暂停当前模板</Button
          >
          <Alert :message="current?.treatment" class="mb-3" />
          <Alert
            class="mb-3"
            type="warning"
            message="科目导入备注只是配置提示，请在会计科目中正式配置辅助核算。本期仅支持客户、供应商、部门、个人、项目；其他维度需人工处理。"
          />
          <a
            v-if="current"
            :href="current.basis"
            target="_blank"
            rel="noreferrer"
            >查看财政部账务处理依据</a
          >
          <div class="my-3">
            <Button @click="addDefaults">补齐默认科目行</Button
            ><Button
              class="ml-2"
              @click="
                config.mappings.push({
                  scenario: active,
                  role: current?.roles[0] || '',
                })
              "
              >添加类别覆盖</Button
            >
          </div>
          <Table
            :data-source="mappings"
            :pagination="false"
            :scroll="{ x: 900, y: 'calc(70vh - 200px)' }"
            :columns="[
              { title: '科目角色', key: 'role' },
              { title: '配件类别（留空为默认）', key: 'category' },
              { title: '实际末级科目', key: 'subject' },
              { title: '操作', key: 'actions', width: 80 },
            ]"
          >
            <template #bodyCell="{ column, record }">
              <Select
                v-if="column.key === 'role'"
                v-model:value="record.role"
                class="w-52"
                :options="
                  current?.roles.map((r) => ({
                    value: r,
                    label: ROLE_LABELS[r] || r,
                  }))
                "
              />
              <Select
                v-else-if="column.key === 'category'"
                v-model:value="record.categoryId"
                allow-clear
                show-search
                option-filter-prop="label"
                class="w-56"
                :options="categoryOptions"
              />
              <Select
                v-else-if="column.key === 'subject'"
                v-model:value="record.subjectId"
                show-search
                option-filter-prop="label"
                class="w-80"
                :options="subjectOptions"
              />
              <Button
                v-else-if="column.key === 'actions'"
                type="link"
                danger
                @click="
                  config.mappings.splice(
                    config.mappings.findIndex((m) => m === record),
                    1,
                  )
                "
                >删除</Button
              >
            </template>
          </Table>
          <div
            v-for="m in mappings.filter(
              (m) => choices.subjects.find((s) => s.id === m.subjectId)?.remark,
            )"
            :key="`${m.role}-${m.categoryId}`"
            class="mt-2 text-gray-500"
          >
            {{ ROLE_LABELS[m.role] }} — 科目备注提示：{{
              choices.subjects.find((s) => s.id === m.subjectId)?.remark
            }}
          </div>
          <p class="mt-3 text-gray-500">
            匹配顺序：当前配件类别 → 最近上级类别 →
            场景默认科目。科目辅助核算要求请在“会计科目”中维护。
          </p>
        </TabPane>
        <TabPane key="accounts" tab="结算账户映射">
          <Button class="mb-3" @click="config.accounts.push({})"
            >添加账户映射</Button
          >
          <Table
            :data-source="config.accounts"
            :pagination="false"
            :scroll="{ x: 800, y: 'calc(70vh - 160px)' }"
            :columns="[
              { title: '结算账户', key: 'account' },
              { title: '资金末级科目', key: 'subject' },
              { title: '操作', key: 'actions' },
            ]"
          >
            <template #bodyCell="{ column, record }">
              <Select
                v-if="column.key === 'account'"
                v-model:value="record.accountId"
                show-search
                option-filter-prop="label"
                class="w-72"
                :options="accountOptions"
              />
              <Select
                v-else-if="column.key === 'subject'"
                v-model:value="record.subjectId"
                show-search
                option-filter-prop="label"
                class="w-80"
                :options="subjectOptions"
              />
              <Button
                v-else
                type="link"
                danger
                @click="
                  config.accounts.splice(config.accounts.indexOf(record), 1)
                "
                >删除</Button
              >
            </template>
          </Table>
        </TabPane>
        <TabPane key="projects" tab="项目辅助核算">
          <Button
            class="mb-3"
            @click="
              config.projects.push({ name: '', enabled: true, deptIds: [] })
            "
            >新增项目</Button
          >
          <div
            v-for="(project, i) in config.projects"
            :key="project.id ?? `new-${i}`"
            class="mb-3 rounded border p-3"
          >
            <Input
              v-model:value="project.name"
              class="mr-3 w-72"
              placeholder="项目名称"
            /><Switch
              v-model:checked="project.enabled"
              checked-children="启用"
              un-checked-children="停用"
            />
            <div class="mt-3">
              <Checkbox
                :checked="
                  deptOptions.length > 0 &&
                  deptOptions.every((d) => project.deptIds.includes(d.value))
                "
                @change="
                  (event) =>
                    selectProjectDepartments(project, !!event.target.checked)
                "
                >全选可用部门</Checkbox
              >
            </div>
            <CheckboxGroup
              v-model:value="project.deptIds"
              class="mt-2 flex flex-wrap gap-3"
              :options="projectDepartments(project.deptIds)"
            />
          </div>
        </TabPane>
      </Tabs>
    </Card>
  </Page>
</template>
