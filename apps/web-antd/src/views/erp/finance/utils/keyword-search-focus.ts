import type { Ref } from 'vue';

import {
  focusFirstEditableInput,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';

export const FINANCE_KEYWORD_SEARCH_INPUT_SELECTOR = [
  'input[data-erp-keyword-search-input="true"]',
  '[data-erp-keyword-search-input="true"] input',
].join(',');

export const FINANCE_KEYWORD_SEARCH_FOCUS_MAX_ATTEMPTS = 12;

export function queueFocusFinanceKeywordSearchInput(
  scopeRef: Ref<HTMLElement | undefined>,
  attempt = 1,
) {
  queueAfterEditableControlRender(() => {
    const focused = focusFirstEditableInput(
      scopeRef.value,
      FINANCE_KEYWORD_SEARCH_INPUT_SELECTOR,
    );
    if (
      focused ||
      attempt >= FINANCE_KEYWORD_SEARCH_FOCUS_MAX_ATTEMPTS ||
      typeof window === 'undefined'
    ) {
      return;
    }
    window.setTimeout(
      () => queueFocusFinanceKeywordSearchInput(scopeRef, attempt + 1),
      50,
    );
  });
}
