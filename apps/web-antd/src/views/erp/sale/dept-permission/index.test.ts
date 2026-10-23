import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DeptPermission from './index.vue';

const mocks = vi.hoisted(() => ({
  canSave: true,
  depts: vi.fn(),
  forbidden: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => mocks.canSave }),
}));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<div><slot /></div>' },
}));
vi.mock('@vben/utils', () => ({ handleTree: (rows: unknown[]) => rows }));
vi.mock('#/api/system/dept', () => ({ getSimpleDeptList: mocks.depts }));
vi.mock('#/api/erp/sale/dept-permission', () => ({
  getSaleDirectForbiddenDepts: mocks.forbidden,
  saveSaleDirectForbiddenDepts: mocks.save,
}));

let app: App;
let root: HTMLDivElement;

async function settle() {
  await Promise.resolve();
  await nextTick();
  await nextTick();
}

async function mountPage() {
  root = document.createElement('div');
  document.body.append(root);
  app = createApp(DeptPermission);
  app.mount(root);
  await settle();
}

function checkbox(name: string) {
  const row = [...root.querySelectorAll('tbody tr')].find((item) =>
    item.textContent?.includes(name),
  );
  const input = row?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!input) throw new Error(`未找到部门 ${name}`);
  return input;
}

function button(label: string) {
  return [...root.querySelectorAll('button')].find((item) =>
    item.textContent?.replaceAll(' ', '').includes(label),
  );
}

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) throw new Error('未找到页面控件');
  return value;
}

async function search(value: string) {
  const input = required(
    root.querySelector<HTMLInputElement>('input[placeholder]'),
  );
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await settle();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canSave = true;
  // 与后端旧版 simple-list 的实际响应一致：启用部门不携带 status。
  mocks.depts.mockResolvedValue([
    { id: 1, name: '兴宇路通', parentId: 0 },
    { id: 2, name: '阿坝分公司', parentId: 0 },
    { id: 3, name: '停用部门', parentId: 0, status: 1 },
  ]);
  mocks.forbidden.mockResolvedValue([{ deptId: 2 }, { deptId: 99 }]);
  mocks.save.mockResolvedValue(true);
});

afterEach(() => {
  app?.unmount();
  root?.remove();
});

describe('销售开单部门权限', () => {
  it('缺少状态的启用部门可以勾选，每行只显示一个开单权限标签', async () => {
    await mountPage();
    expect(checkbox('兴宇路通').disabled).toBe(false);
    expect(checkbox('阿坝分公司').checked).toBe(true);
    checkbox('兴宇路通').click();
    await settle();
    expect(checkbox('兴宇路通').checked).toBe(true);
    const rows = [...root.querySelectorAll('tbody tr')].filter((row) =>
      row.querySelector('input'),
    );
    for (const row of rows) {
      expect(row.querySelectorAll('.ant-tag')).toHaveLength(1);
    }
    expect(root.textContent).toContain('开单权限');
    expect(root.textContent?.replaceAll(' ', '')).toContain(
      '停用部门（已停用）',
    );
    expect(checkbox('停用部门').disabled).toBe(true);
  });

  it('搜索后全选仅影响筛选结果，保存保留不可见的既有禁开部门', async () => {
    await mountPage();
    await search('兴宇路通');
    required(
      root.querySelector<HTMLInputElement>('thead input[type="checkbox"]'),
    ).click();
    await settle();
    required(button('保存')).click();
    await settle();
    expect(mocks.save).toHaveBeenCalledWith({ deptIds: [2, 99, 1] });
    expect(mocks.depts).toHaveBeenCalledTimes(2);
    expect(mocks.forbidden).toHaveBeenCalledTimes(2);
  });

  it('取消勾选、清空搜索和刷新保持原有行为', async () => {
    await mountPage();
    checkbox('阿坝分公司').click();
    await settle();
    expect(checkbox('阿坝分公司').checked).toBe(false);
    await search('没有匹配');
    expect(
      required(root.querySelector<HTMLInputElement>('thead input')).disabled,
    ).toBe(true);
    await search('');
    required(button('刷新')).click();
    await settle();
    expect(checkbox('阿坝分公司').checked).toBe(true);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('无修改权限时仍禁止单选和全选，并隐藏保存按钮', async () => {
    mocks.canSave = false;
    await mountPage();
    for (const input of root.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    )) {
      expect(input.disabled).toBe(true);
    }
    expect(button('保存')).toBeUndefined();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
