import { createApp, defineComponent, h, nextTick, ref } from 'vue';

import { Select } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import {
  provideFinanceCandidateFocus,
  useFinanceCandidateFocus,
} from './candidate-focus';

describe('finance single-select candidate activity', () => {
  it('moves the actual active option with keyboard and mouse while preserving selected and disabled options', async () => {
    const onChange = vi.fn();
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp(
      defineComponent({
        setup() {
          const controls = provideFinanceCandidateFocus();
          return () =>
            h(Select, {
              open: true,
              value: 1,
              showSearch: true,
              popupClassName: controls.candidatePopupClass('finance-test'),
              options: [
                { value: 1, label: '第一个' },
                { value: 2, label: '禁用项', disabled: true },
                { value: 3, label: '第三个' },
              ],
              onChange,
            });
        },
      }),
    );
    try {
      app.mount(host);
      await vi.waitFor(() =>
        expect(
          document.querySelectorAll('.finance-test .ant-select-item-option'),
        ).toHaveLength(3),
      );
      const input = host.querySelector('input')!;
      input.focus();
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          code: 'ArrowDown',
          keyCode: 40,
          bubbles: true,
        }),
      );
      await vi.waitFor(() =>
        expect(
          document.querySelector('.finance-test .ant-select-item-option-active')
            ?.textContent,
        ).toBe('第三个'),
      );
      expect(
        document.querySelector('.finance-test .ant-select-item-option-selected')
          ?.textContent,
      ).toBe('第一个');
      expect(
        document.querySelector('.finance-test .ant-select-item-option-disabled')
          ?.textContent,
      ).toBe('禁用项');
      document
        .querySelector('.finance-test .ant-select-item-option')!
        .dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      await vi.waitFor(() =>
        expect(
          document.querySelector('.finance-test .ant-select-item-option-active')
            ?.textContent,
        ).toBe('第一个'),
      );
      expect(
        document.querySelectorAll(
          '.finance-test .ant-select-item-option-active',
        ),
      ).toHaveLength(1);
      expect(document.activeElement).toBe(input);
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      app.unmount();
      host.remove();
      await nextTick();
    }
  });

  it('renders a report child without the yellow marker even under an enabled business ancestor', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const Consumer = defineComponent({
      setup() {
        const controls = useFinanceCandidateFocus();
        return () =>
          h(Select, {
            open: true,
            popupClassName: controls.candidatePopupClass('report-test'),
            options: [{ label: '报表选项', value: 1 }],
          });
      },
    });
    const Report = defineComponent({
      setup() {
        provideFinanceCandidateFocus(ref(false));
        return () => h(Consumer);
      },
    });
    const app = createApp(
      defineComponent({
        setup() {
          provideFinanceCandidateFocus();
          return () => h(Report);
        },
      }),
    );
    try {
      app.mount(host);
      await vi.waitFor(() =>
        expect(document.querySelector('.report-test')).not.toBeNull(),
      );
      expect(
        document
          .querySelector('.report-test')
          ?.classList.contains('erp-candidate-focus-popup'),
      ).toBe(false);
    } finally {
      app.unmount();
      host.remove();
      await nextTick();
    }
  });
});
