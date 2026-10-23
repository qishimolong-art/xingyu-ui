import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readSource(...paths: string[]) {
  return readFileSync(join(currentDir, ...paths), 'utf8');
}

const searchListPages = [
  ['member-user', readSource('user', 'index.vue')],
  ['member-level', readSource('level', 'index.vue')],
  ['member-tag', readSource('tag', 'index.vue')],
  ['member-group', readSource('group', 'index.vue')],
  ['point-record', readSource('point', 'record', 'index.vue')],
  ['signin-record', readSource('signin', 'record', 'index.vue')],
] as const;

const detailSearchLists = [
  ['detail-point', readSource('user', 'detail', 'modules', 'point-list.vue')],
  ['detail-sign', readSource('user', 'detail', 'modules', 'sign-list.vue')],
  [
    'detail-experience',
    readSource('user', 'detail', 'modules', 'experience-record-list.vue'),
  ],
  ['detail-coupon', readSource('user', 'detail', 'modules', 'coupon-list.vue')],
  ['detail-order', readSource('user', 'detail', 'modules', 'order-list.vue')],
  [
    'detail-after-sale',
    readSource('user', 'detail', 'modules', 'after-sale-list.vue'),
  ],
  [
    'detail-brokerage',
    readSource('user', 'detail', 'modules', 'brokerage-list.vue'),
  ],
] as const;

const compactOnlyGrids = [
  ['signin-config', readSource('signin', 'config', 'index.vue')],
  [
    'detail-balance',
    readSource('user', 'detail', 'modules', 'balance-list.vue'),
  ],
  [
    'detail-address',
    readSource('user', 'detail', 'modules', 'address-list.vue'),
  ],
  [
    'detail-favorite',
    readSource('user', 'detail', 'modules', 'favorite-list.vue'),
  ],
] as const;
const pureDetailGridSources = compactOnlyGrids
  .slice(1)
  .map(([, source]) => source);

const formModals = [
  ['member-user-form', readSource('user', 'modules', 'form.vue')],
  ['member-level-form', readSource('user', 'modules', 'level-form.vue')],
  ['member-point-form', readSource('user', 'modules', 'point-form.vue')],
  ['member-balance-form', readSource('user', 'modules', 'balance-form.vue')],
  ['level-form', readSource('level', 'modules', 'form.vue')],
  ['tag-form', readSource('tag', 'modules', 'form.vue')],
  ['group-form', readSource('group', 'modules', 'form.vue')],
  ['signin-config-form', readSource('signin', 'config', 'modules', 'form.vue')],
] as const;

const memberUserSource = readSource('user', 'index.vue');
const memberDetailSource = readSource('user', 'detail', 'index.vue');
const memberRouteSource = readSource(
  '..',
  '..',
  'router',
  'routes',
  'modules',
  'member.ts',
);
const configSource = readSource('config', 'index.vue');
const compactGridSource = readSource('styles', 'compact-grid.css');
const gridSearchSource = readSource('utils', 'grid-search.ts');

function expectCompactGrid(name: string, source: string) {
  expect(source, name).toContain("showHeaderOverflow: 'tooltip'");
  expect(source, name).toContain("showOverflow: 'tooltip'");
  expect(source, name).toContain('scrollX:');
  expect(source, name).toContain('member-compact-grid');
}

describe('member center ERP style contract', () => {
  it('uses compact collapsed search on searchable member-center list grids', () => {
    for (const [name, source] of [...searchListPages, ...detailSearchLists]) {
      expect(source, name).toContain('collapsed: true');
      expect(source, name).toContain('collapsedRows: 1');
      expect(source, name).toContain('commonConfig: { labelWidth: 68 }');
      expect(source, name).toContain('handleMemberSearchEnter');
      expect(source, name).toContain(
        '@keydown.enter.capture="handleSearchEnter"',
      );
      expectCompactGrid(name, source);
    }
  });

  it('keeps pure member detail grids compact without adding fake search forms', () => {
    for (const [name, source] of compactOnlyGrids) {
      expectCompactGrid(name, source);
    }
    for (const source of pureDetailGridSources) {
      expect(source).not.toContain('formOptions:');
    }
  });

  it('keeps member forms and detail page on the agreed interaction model', () => {
    for (const [name, source] of formModals) {
      expect(source, name).toContain('styles/compact-grid.css');
      expect(source, name).toContain('member-edit-form');
      expect(source, name).toContain('max-w-[96vw]');
    }

    expect(configSource).toContain('member-config-form');
    expect(compactGridSource).toContain('.member-edit-form');
    expect(compactGridSource).toContain('.vxe-grid--pager-wrapper');
    expect(compactGridSource).toContain('position: sticky');
    expect(gridSearchSource).toContain("tagName === 'TEXTAREA'");

    expect(memberRouteSource).toContain("name: 'MemberUserDetail'");
    expect(memberDetailSource).toContain('useRoute()');
    expect(memberDetailSource).not.toContain('fullscreen');
    expect(memberUserSource).toContain("name: 'MemberUserDetail'");
    expect(memberUserSource).not.toContain('cellClick');
    expect(memberUserSource).not.toContain('@cell-click');
  });
});
