import type { InjectionKey } from 'vue';

import { inject, provide } from 'vue';

const REPORT_VIEW_ONLY_KEY: InjectionKey<boolean> = Symbol(
  'erp-report-view-only',
);

export function provideReportViewOnly() {
  provide(REPORT_VIEW_ONLY_KEY, true);
}

export function useReportViewOnly() {
  return inject(REPORT_VIEW_ONLY_KEY, false);
}
