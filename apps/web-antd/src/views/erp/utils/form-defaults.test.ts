import type { ErpGridOptionsWithForm } from './form-defaults';

import { describe, expect, it } from 'vitest';

import {
  createErpKeywordSearchSchema,
  getCurrentLocalDate,
  getCurrentLocalDateTime,
  getCurrentLocalMonth,
  getCurrentTimestamp,
  withErpCollapsedSearchDefaults,
} from './form-defaults';

describe('form defaults', () => {
  it('returns a numeric timestamp', () => {
    const value = getCurrentTimestamp();
    expect(typeof value).toBe('number');
    expect(Number.isFinite(value)).toBe(true);
  });

  it('formats local date and time', () => {
    const value = new Date(2026, 5, 1, 9, 8, 7);
    expect(getCurrentLocalDate(value)).toBe('2026-06-01');
    expect(getCurrentLocalMonth(value)).toBe('2026-06');
    expect(getCurrentLocalDateTime(value)).toBe('2026-06-01 09:08:07');
  });

  it('defaults ERP grid search forms to collapsed', () => {
    const schema = [{ fieldName: 'keyword' }];
    const options = withErpCollapsedSearchDefaults({
      formOptions: { schema },
      gridOptions: { toolbarConfig: { search: true } },
    } as ErpGridOptionsWithForm);

    expect(options.formOptions?.collapsed).toBe(true);
    expect(options.formOptions?.collapsedRows).toBe(1);
    expect(options.formOptions?.schema).toBe(schema);
  });

  it('adds keyword search schema before existing ERP search fields', () => {
    const schema = [{ fieldName: 'name' }];
    const options = withErpCollapsedSearchDefaults({
      formOptions: { schema },
    } as ErpGridOptionsWithForm);

    expect(options.formOptions?.schema?.[0]?.fieldName).toBe('keyword');
    expect(options.formOptions?.schema?.[1]).toBe(schema[0]);
  });

  it('does not duplicate existing keyword search schema', () => {
    const schema = [createErpKeywordSearchSchema(), { fieldName: 'name' }];
    const options = withErpCollapsedSearchDefaults({
      formOptions: { schema },
    } as ErpGridOptionsWithForm);

    expect(
      options.formOptions?.schema?.filter(
        (item: any) => item.fieldName === 'keyword',
      ),
    ).toHaveLength(1);
  });

  it('allows keyword search schema placeholder overrides', () => {
    const schema = createErpKeywordSearchSchema({
      placeholder: '请输入产品关键词',
    });

    expect(schema.componentProps.placeholder).toBe('请输入产品关键词');
  });

  it('marks keyword search input for autofocus targeting', () => {
    const schema = createErpKeywordSearchSchema();

    expect(schema.componentProps['data-erp-keyword-search-input']).toBe('true');
  });

  it('allows collapsed ERP search forms to override keyword placeholder', () => {
    const options = withErpCollapsedSearchDefaults({
      formOptions: {
        keywordSearchPlaceholder: '请输入关键词，产品多个条件可用 / 或空格分隔',
        schema: [{ fieldName: 'name' }],
      },
    } as ErpGridOptionsWithForm);

    expect(options.formOptions?.schema?.[0]?.componentProps?.placeholder).toBe(
      '请输入关键词，产品多个条件可用 / 或空格分隔',
    );
  });

  it('does not add a search form when formOptions is missing', () => {
    const options = { gridOptions: { toolbarConfig: { refresh: true } } };

    expect(withErpCollapsedSearchDefaults(options)).toBe(options);
  });

  it('preserves explicit ERP collapsed-search settings', () => {
    const options = withErpCollapsedSearchDefaults({
      formOptions: {
        collapsed: false,
        collapsedRows: 2,
        schema: [{ fieldName: 'name' }],
      },
    } as ErpGridOptionsWithForm);

    expect(options.formOptions?.collapsed).toBe(false);
    expect(options.formOptions?.collapsedRows).toBe(2);
  });
});
