<script setup lang="ts">
interface ReadinessItem {
  description: string;
  status: string;
  title: string;
}

defineOptions({ name: 'ErpFinancialStatementReadiness' });

defineProps<{
  items: ReadinessItem[];
  statementName: string;
  warning: string;
}>();
</script>

<template>
  <section class="financial-statement-readiness">
    <div class="financial-statement-readiness__head">
      <div>
        <strong>{{ statementName }}正式输出前置条件</strong>
        <p>{{ warning }}</p>
      </div>
      <span>待规则确认</span>
    </div>
    <div class="financial-statement-readiness__grid">
      <article v-for="item in items" :key="item.title">
        <div>
          <strong>{{ item.title }}</strong>
          <span>{{ item.status }}</span>
        </div>
        <p>{{ item.description }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.financial-statement-readiness {
  flex: 0 0 auto;
  padding: 14px;
  margin-bottom: 12px;
  background: #fff;
  border: 1px solid #dce2ec;
  border-radius: 6px;
}

.financial-statement-readiness__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.financial-statement-readiness__head strong {
  color: #173461;
  font-size: 16px;
}

.financial-statement-readiness__head p,
.financial-statement-readiness article p {
  margin: 6px 0 0;
  color: #5a6779;
  line-height: 1.7;
}

.financial-statement-readiness__head > span,
.financial-statement-readiness article span {
  flex: 0 0 auto;
  padding: 2px 8px;
  color: #b7791f;
  background: #fff8e5;
  border: 1px solid #f4d99b;
  border-radius: 999px;
  font-size: 12px;
}

.financial-statement-readiness__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.financial-statement-readiness article {
  padding: 12px;
  background: #f7faff;
  border: 1px solid #e4eaf2;
  border-radius: 4px;
}

.financial-statement-readiness article div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.financial-statement-readiness article strong {
  color: #243348;
}

@media (max-width: 1180px) {
  .financial-statement-readiness__grid {
    grid-template-columns: 1fr;
  }
}
</style>
