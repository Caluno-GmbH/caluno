import { describe, expect, it } from 'bun:test';
import {
  applyQueryParamValue,
  hrefWithSearch,
  parseQueryParamValue,
} from './query-param-tab';

const TABS = ['forms', 'blocks'] as const;

describe('parseQueryParamValue', () => {
  it('returns a known value', () => {
    expect(parseQueryParamValue('blocks', TABS, 'forms')).toBe('blocks');
  });

  it('falls back for null, undefined, empty, or unknown', () => {
    expect(parseQueryParamValue(null, TABS, 'forms')).toBe('forms');
    expect(parseQueryParamValue(undefined, TABS, 'forms')).toBe('forms');
    expect(parseQueryParamValue('', TABS, 'forms')).toBe('forms');
    expect(parseQueryParamValue('bogus', TABS, 'forms')).toBe('forms');
  });
});

describe('applyQueryParamValue', () => {
  it('sets the param and preserves others', () => {
    expect(applyQueryParamValue('q=1', 'tab', 'blocks')).toBe('q=1&tab=blocks');
  });

  it('omits the param when value matches omitWhen', () => {
    expect(
      applyQueryParamValue('tab=blocks&q=1', 'tab', 'forms', {
        omitWhen: 'forms',
      }),
    ).toBe('q=1');
  });

  it('returns an empty string when the last param is omitted', () => {
    expect(
      applyQueryParamValue('tab=blocks', 'tab', 'forms', { omitWhen: 'forms' }),
    ).toBe('');
  });
});

describe('hrefWithSearch', () => {
  it('joins pathname and search, or drops the query when empty', () => {
    expect(hrefWithSearch('/admin/x/forms', 'tab=blocks')).toBe(
      '/admin/x/forms?tab=blocks',
    );
    expect(hrefWithSearch('/admin/x/forms', '')).toBe('/admin/x/forms');
  });
});
