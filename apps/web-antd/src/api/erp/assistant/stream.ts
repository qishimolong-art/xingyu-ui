export interface AssistantEvent {
  event: string;
  data: Record<string, any>;
}

/** Incremental SSE decoder: supports split UTF-8, CRLF and multi-line data. */
export async function readAssistantStream(
  body: ReadableStream<Uint8Array>,
  receive: (event: AssistantEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let complete = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      pending = pending.replaceAll('\r\n', '\n');
      let boundary;
      while ((boundary = pending.indexOf('\n\n')) >= 0) {
        const block = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        let event = 'message';
        const data: string[] = [];
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
        }
        if (data.length > 0) {
          receive({ event, data: JSON.parse(data.join('\n')) });
          if (event === 'done' || event === 'error') complete = true;
        }
      }
      if (done) break;
    }
    if (!complete)
      throw new Error('连接已中断，请重新查询；本次结果可能尚未完成');
  } finally {
    reader.releaseLock();
  }
}
