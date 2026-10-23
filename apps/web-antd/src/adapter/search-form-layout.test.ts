import { describe, expect, it } from 'vitest';

import {
  SEARCH_FORM_WRAPPER_CLASS,
  withFourColumnSearchFormLayout,
} from './search-form-layout';

describe('withFourColumnSearchFormLayout', () => {
  it('keeps grid options without a search form unchanged', () => {
    const options = { gridOptions: { columns: [] } };

    expect(withFourColumnSearchFormLayout(options)).toBe(options);
  });

  it('applies the shared responsive four-column layout', () => {
    const options = {
      formOptions: {
        schema: [{ fieldName: 'keyword' }],
        wrapperClass: 'grid-cols-2',
      },
    };

    expect(withFourColumnSearchFormLayout(options)).toEqual({
      formOptions: {
        schema: [{ fieldName: 'keyword' }],
        wrapperClass: SEARCH_FORM_WRAPPER_CLASS,
      },
    });
    expect(options.formOptions.wrapperClass).toBe('grid-cols-2');
  });
});
