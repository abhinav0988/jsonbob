/** Parse / stringify JSON off the main thread when text is large. */

export type ParseResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

function syncParse(text: string): ParseResult {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" };
  }
}

export async function parseJsonAsync(text: string, threshold = 200_000): Promise<ParseResult> {
  if (text.length < threshold || typeof Worker === "undefined") {
    return syncParse(text);
  }

  return new Promise((resolve) => {
    const workerCode = `
      self.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          self.postMessage({ ok: true, data });
        } catch (err) {
          self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
        }
      };
    `;
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    const timer = window.setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(syncParse(text));
    }, 15_000);
    worker.onmessage = (e: MessageEvent<ParseResult>) => {
      window.clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(e.data);
    };
    worker.onerror = () => {
      window.clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(syncParse(text));
    };
    worker.postMessage(text);
  });
}
