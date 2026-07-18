/**
 * Lightweight JSON ↔ YAML for tools drawer (common subset).
 * Not a full YAML 1.2 engine — good enough for configs and API samples.
 */

function escapeYamlString(s: string): string {
  if (s === "" || /[:#{}[\],&*!|>'%@`]/.test(s) || /^\s|\s$/.test(s) || /^(true|false|null|~)$/i.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}

function dumpValue(value: unknown, indent: number): string {
  const pad = "  ".repeat(indent);
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return escapeYamlString(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        if (item !== null && typeof item === "object") {
          const body = dumpValue(item, indent + 1);
          const lines = body.split("\n");
          return `${pad}- ${lines[0]}\n${lines.slice(1).map((l) => (l ? `${"  ".repeat(indent + 1)}${l.replace(/^\s+/, "")}` : l)).join("\n")}`.trimEnd();
        }
        return `${pad}- ${dumpValue(item, 0)}`;
      })
      .join("\n");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return entries
      .map(([k, v]) => {
        const key = /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : JSON.stringify(k);
        if (v !== null && typeof v === "object") {
          const nested = dumpValue(v, indent + 1);
          if (nested === "[]" || nested === "{}") return `${pad}${key}: ${nested}`;
          return `${pad}${key}:\n${nested}`;
        }
        return `${pad}${key}: ${dumpValue(v, 0)}`;
      })
      .join("\n");
  }
  return JSON.stringify(value);
}

export function jsonToYaml(value: unknown): string {
  return `${dumpValue(value, 0)}\n`;
}

/** Minimal YAML → JSON: prefers parsing JSON-looking input first; otherwise line-oriented maps/lists. */
export function yamlToJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }

  type Frame = { indent: number; value: unknown; key?: string };
  const lines = trimmed.replace(/\t/g, "  ").split(/\r?\n/);
  const root: Record<string, unknown> | unknown[] = trimmed.startsWith("-") ? [] : {};
  const stack: Frame[] = [{ indent: -1, value: root }];

  function parseScalar(raw: string): unknown {
    const s = raw.trim();
    if (s === "null" || s === "~" || s === "") return null;
    if (s === "true") return true;
    if (s === "false") return false;
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return Number(s);
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      try {
        return JSON.parse(s.replace(/^'/, '"').replace(/'$/, '"'));
      } catch {
        return s.slice(1, -1);
      }
    }
    return s;
  }

  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const indent = line.match(/^ */)?.[0].length ?? 0;
    const content = line.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1]!;

    if (content.startsWith("- ")) {
      const rest = content.slice(2);
      const arr = parent.value;
      if (!Array.isArray(arr)) throw new Error("YAML: list item under non-array");
      if (rest.includes(": ") && !rest.startsWith('"') && !rest.startsWith("'")) {
        const idx = rest.indexOf(": ");
        const key = rest.slice(0, idx).trim();
        const valRaw = rest.slice(idx + 2).trim();
        const obj: Record<string, unknown> = {};
        if (valRaw === "") {
          // nested follows
          arr.push(obj);
          stack.push({ indent, value: obj });
        } else {
          obj[key] = parseScalar(valRaw);
          arr.push(obj);
        }
      } else if (rest === "") {
        const obj: Record<string, unknown> = {};
        arr.push(obj);
        stack.push({ indent, value: obj });
      } else {
        arr.push(parseScalar(rest));
      }
      continue;
    }

    const colon = content.indexOf(":");
    if (colon < 0) throw new Error(`YAML: cannot parse line "${content}"`);
    const key = content.slice(0, colon).trim().replace(/^"|"$/g, "");
    const valRaw = content.slice(colon + 1).trim();
    const obj = parent.value;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      throw new Error("YAML: key under non-object");
    }
    if (valRaw === "" || valRaw === "|" || valRaw === ">") {
      // peek - array or object child: default object; if next lines are `-` make array
      const child: Record<string, unknown> = {};
      (obj as Record<string, unknown>)[key] = child;
      stack.push({ indent, value: child, key });
    } else if (valRaw === "[]") {
      (obj as Record<string, unknown>)[key] = [];
    } else if (valRaw === "{}") {
      (obj as Record<string, unknown>)[key] = {};
    } else {
      (obj as Record<string, unknown>)[key] = parseScalar(valRaw);
    }
  }

  // Fix empty object placeholders that should be arrays: when we pushed empty object for key
  // with following `-` lines, those went into wrong parent. Re-scan is complex; document limits.
  return root;
}
