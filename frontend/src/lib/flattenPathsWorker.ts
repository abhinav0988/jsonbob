/** Flatten JSON paths off the main thread for large documents. */

export async function flattenPathsAsync(
  value: unknown,
  max = 2000,
  thresholdChars = 100_000,
): Promise<string[]> {
  const text = JSON.stringify(value);
  if (text.length < thresholdChars || typeof Worker === "undefined") {
    const { collectJsonPaths } = await import("./collectJsonPaths");
    return collectJsonPaths(value, max);
  }

  return new Promise((resolve) => {
    const workerCode = `
      function walk(node, path, out, max) {
        if (out.length >= max) return;
        out.push(path);
        if (node === null || typeof node !== "object") return;
        if (Array.isArray(node)) {
          for (let i = 0; i < node.length; i++) {
            if (out.length >= max) return;
            walk(node[i], path + "[" + i + "]", out, max);
          }
          return;
        }
        for (const key of Object.keys(node)) {
          if (out.length >= max) return;
          const next = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
            ? path + "." + key
            : path + "[" + JSON.stringify(key) + "]";
          walk(node[key], next, out, max);
        }
      }
      self.onmessage = (e) => {
        const { data, max } = e.data;
        const out = [];
        try {
          walk(data, "$", out, max || 2000);
          self.postMessage({ ok: true, paths: out });
        } catch (err) {
          self.postMessage({ ok: false, paths: ["$"] });
        }
      };
    `;
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    const timer = window.setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      import("./collectJsonPaths").then(({ collectJsonPaths }) =>
        resolve(collectJsonPaths(value, max)),
      );
    }, 12_000);
    worker.onmessage = (e: MessageEvent<{ ok: boolean; paths: string[] }>) => {
      window.clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(e.data.paths ?? ["$"]);
    };
    worker.onerror = () => {
      window.clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      import("./collectJsonPaths").then(({ collectJsonPaths }) =>
        resolve(collectJsonPaths(value, max)),
      );
    };
    worker.postMessage({ data: value, max });
  });
}
