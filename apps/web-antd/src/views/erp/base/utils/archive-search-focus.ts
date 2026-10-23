import type { Ref } from 'vue';

import {
  focusFirstEditableInput,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';

const ARCHIVE_SEARCH_INPUT_SELECTOR_GROUPS = [
  [
    'input[data-erp-keyword-search-input="true"]',
    '[data-erp-keyword-search-input="true"] input',
  ],
  [
    'input[data-erp-archive-name-search-input="true"]',
    '[data-erp-archive-name-search-input="true"] input',
  ],
  [
    'input[data-erp-archive-code-search-input="true"]',
    '[data-erp-archive-code-search-input="true"] input',
  ],
];

export const ARCHIVE_SEARCH_INPUT_SELECTOR =
  ARCHIVE_SEARCH_INPUT_SELECTOR_GROUPS.flat().join(',');

export const ARCHIVE_SEARCH_FOCUS_MAX_ATTEMPTS = 12;

export function queueFocusArchiveSearchInput(
  scopeRef: Ref<HTMLElement | undefined>,
  attempt = 1,
) {
  queueAfterEditableControlRender(() => {
    const focused = ARCHIVE_SEARCH_INPUT_SELECTOR_GROUPS.some((selectors) =>
      focusFirstEditableInput(scopeRef.value, selectors.join(',')),
    );
    if (
      focused ||
      attempt >= ARCHIVE_SEARCH_FOCUS_MAX_ATTEMPTS ||
      typeof window === 'undefined'
    ) {
      return;
    }
    window.setTimeout(
      () => queueFocusArchiveSearchInput(scopeRef, attempt + 1),
      50,
    );
  });
}
