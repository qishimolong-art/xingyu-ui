import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readSource(...paths: string[]) {
  return readFileSync(join(currentDir, ...paths), 'utf8');
}

const listPages = [
  ['article', readSource('article', 'index.vue')],
  ['article-category', readSource('article', 'category', 'index.vue')],
  ['banner', readSource('banner', 'index.vue')],
  ['coupon', readSource('coupon', 'index.vue')],
  ['coupon-template', readSource('coupon', 'template', 'index.vue')],
  ['seckill-config', readSource('seckill', 'config', 'index.vue')],
  ['seckill-activity', readSource('seckill', 'activity', 'index.vue')],
  ['combination-activity', readSource('combination', 'activity', 'index.vue')],
  ['combination-record', readSource('combination', 'record', 'index.vue')],
  ['bargain-activity', readSource('bargain', 'activity', 'index.vue')],
  ['bargain-record', readSource('bargain', 'record', 'index.vue')],
  ['point-activity', readSource('point', 'activity', 'index.vue')],
  ['diy-template', readSource('diy', 'template', 'index.vue')],
  ['diy-page', readSource('diy', 'page', 'index.vue')],
  ['reward-activity', readSource('rewardActivity', 'index.vue')],
  ['discount-activity', readSource('discountActivity', 'index.vue')],
] as const;

const selectionGrids = [
  ['coupon-select', readSource('coupon', 'components', 'select.vue')],
  ['coupon-send', readSource('coupon', 'components', 'send-form.vue')],
  ['seckill-select', readSource('seckill', 'components', 'table-select.vue')],
  [
    'combination-select',
    readSource('combination', 'components', 'table-select.vue'),
  ],
  ['point-select', readSource('point', 'components', 'table-select.vue')],
] as const;

const formModals = [
  ['article-form', readSource('article', 'modules', 'form.vue')],
  [
    'article-category-form',
    readSource('article', 'category', 'modules', 'form.vue'),
  ],
  ['banner-form', readSource('banner', 'modules', 'form.vue')],
  [
    'coupon-template-form',
    readSource('coupon', 'template', 'modules', 'form.vue'),
  ],
  [
    'seckill-config-form',
    readSource('seckill', 'config', 'modules', 'form.vue'),
  ],
  [
    'seckill-activity-form',
    readSource('seckill', 'activity', 'modules', 'form.vue'),
  ],
  [
    'combination-activity-form',
    readSource('combination', 'activity', 'modules', 'form.vue'),
  ],
  [
    'bargain-activity-form',
    readSource('bargain', 'activity', 'modules', 'form.vue'),
  ],
  [
    'point-activity-form',
    readSource('point', 'activity', 'modules', 'form.vue'),
  ],
  ['diy-template-form', readSource('diy', 'template', 'modules', 'form.vue')],
  ['diy-page-form', readSource('diy', 'page', 'modules', 'form.vue')],
  ['reward-activity-form', readSource('rewardActivity', 'modules', 'form.vue')],
  [
    'discount-activity-form',
    readSource('discountActivity', 'modules', 'form.vue'),
  ],
] as const;

const compactGridSource = readSource('styles', 'compact-grid.css');
const gridSearchSource = readSource('utils', 'grid-search.ts');
const diyEditorSource = readSource('components', 'diy-editor', 'index.vue');
const appLinkSource = readSource(
  'components',
  'app-link-input',
  'select-dialog.vue',
);
const hotZoneSource = readSource(
  'components',
  'diy-editor',
  'components',
  'mobile',
  'hot-zone',
  'components',
  'hot-zone-edit-dialog',
  'index.vue',
);

describe('mall promotion center ERP style contract', () => {
  it('uses compact collapsed search on every promotion-center list grid', () => {
    for (const [name, source] of listPages) {
      expect(source, name).toContain('collapsed: true');
      expect(source, name).toContain('collapsedRows: 1');
      expect(source, name).toContain('commonConfig: { labelWidth: 68 }');
      expect(source, name).toContain(
        '@keydown.enter.capture="handleSearchEnter"',
      );
      expect(source, name).toContain("showHeaderOverflow: 'tooltip'");
      expect(source, name).toContain("showOverflow: 'tooltip'");
      expect(source, name).toContain('scrollX:');
      expect(source, name).toContain('mall-promotion-compact-grid');
    }
  });

  it('keeps promotion selection grids compact and searchable by Enter', () => {
    for (const [name, source] of selectionGrids) {
      expect(source, name).toContain('collapsed: true');
      expect(source, name).toContain('collapsedRows: 1');
      expect(source, name).toContain('commonConfig: { labelWidth: 68 }');
      expect(source, name).toContain('handleMallPromotionSearchEnter');
      expect(source, name).toContain(
        '@keydown.enter.capture="handleSearchEnter"',
      );
      expect(source, name).toContain("showHeaderOverflow: 'tooltip'");
      expect(source, name).toContain("showOverflow: 'tooltip'");
      expect(source, name).toContain('scrollX:');
      expect(source, name).toContain('mall-promotion-compact-grid');
    }
  });

  it('keeps promotion forms on ERP modal density without changing editor workbench', () => {
    for (const [name, source] of formModals) {
      expect(source, name).toContain('styles/compact-grid.css');
      expect(source, name).toContain('mall-promotion-edit-form');
      expect(source, name).toContain('max-w-[96vw]');
    }
    expect(compactGridSource).toContain('.mall-promotion-edit-form');
    expect(compactGridSource).toContain('.vxe-grid--pager-wrapper');
    expect(compactGridSource).toContain('position: sticky');
    expect(gridSearchSource).toContain("tagName === 'TEXTAREA'");
    expect(diyEditorSource).not.toContain('mall-promotion-compact-grid');
    expect(appLinkSource).toContain('!w-[960px] max-w-[96vw]');
    expect(hotZoneSource).toContain('!w-[780px] max-w-[96vw]');
  });
});
