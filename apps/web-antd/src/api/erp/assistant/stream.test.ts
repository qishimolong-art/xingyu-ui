import { describe, expect, it } from 'vitest';

import { readAssistantStream } from './stream';

function stream(text: string, chunk = 1) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunk)
        controller.enqueue(bytes.slice(i, i + chunk));
      controller.close();
    },
  });
}
describe('assistant stream', () => {
  it('preserves Chinese across UTF-8 and CRLF chunk boundaries', async () => {
    const events: unknown[] = [];
    await readAssistantStream(
      stream(
        'event: progress\r\ndata: {"text":"正在查询"}\r\n\r\nevent: done\r\ndata: {}\r\n\r\n',
      ),
      (event) => events.push(event),
    );
    expect(events).toEqual([
      { event: 'progress', data: { text: '正在查询' } },
      { event: 'done', data: {} },
    ]);
  });
  it('does not report a disconnected response as complete', async () => {
    await expect(
      readAssistantStream(stream('event: result\ndata: {}\n\n'), () => {}),
    ).rejects.toThrow('连接已中断');
  });
  it('handles server errors without retrying the query', async () => {
    const events: unknown[] = [];
    await readAssistantStream(
      stream('event: error\ndata: {"text":"没有权限"}\n\n'),
      (event) => events.push(event),
    );
    expect(events).toHaveLength(1);
  });
});
