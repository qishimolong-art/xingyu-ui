import type { Ref } from 'vue';

import {
  focusFirstEditableInput,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';

export const STOCK_KEYWORD_SEARCH_INPUT_SELECTOR = [
  'input[data-erp-keyword-search-input="true"]',
  '[data-erp-keyword-search-input="true"] input',
  'input[data-erp-product-keyword-search-input="true"]',
  '[data-erp-product-keyword-search-input="true"] input',
].join(',');

const STOCK_KEYWORD_SEARCH_FOCUS_MAX_ATTEMPTS = 12;

export function queueFocusStockKeywordSearchInput(
  scopeRef: Ref<HTMLElement | undefined>,
  attempt = 1,
) {
  queueAfterEditableControlRender(() => {
    const focused = focusFirstEditableInput(
      scopeRef.value,
      STOCK_KEYWORD_SEARCH_INPUT_SELECTOR,
    );
    if (
      focused ||
      attempt >= STOCK_KEYWORD_SEARCH_FOCUS_MAX_ATTEMPTS ||
      typeof window === 'undefined'
    ) {
      return;
    }
    window.setTimeout(
      () => queueFocusStockKeywordSearchInput(scopeRef, attempt + 1),
      50,
    );
  });
}
