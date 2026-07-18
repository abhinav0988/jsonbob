import { useMemo, useState } from "react";
import { BottomSheet } from "../../components/mobile/BottomSheet";
import {
  base64Decode,
  base64Encode,
  csvToJson,
  decodeJwt,
  flattenJson,
  generateUuidsInPlace,
  jsonToCsv,
  mapKeysDeep,
  sortArraysDeep,
  toCamel,
  toPascal,
  toSnake,
  unescapeJsonString,
  escapeJsonString,
  unflattenJson,
  urlDecode,
  urlEncode,
} from "../../lib/jsonToolsExtended";
import { applyJsonPatch, applyMergePatch, parsePatchDocument } from "../../lib/jsonPatch";
import { jsonToYaml, yamlToJson } from "../../lib/yamlLite";
import {
  jsonToXml,
  xmlToJson,
  jsonToToml,
  tomlToJson,
  jsonToSqlInsert,
  jsonToOpenApiStub,
} from "../../lib/convertersExtra";
import { minifyJson, prettyPrint, sortJsonKeys } from "../../components/editor/jsonTools";

type ToolId =
  | "pretty"
  | "minify"
  | "sortKeys"
  | "sortArrays"
  | "snake"
  | "camel"
  | "pascal"
  | "upper"
  | "lower"
  | "flatten"
  | "unflatten"
  | "toCsv"
  | "fromCsv"
  | "toYaml"
  | "fromYaml"
  | "toXml"
  | "fromXml"
  | "toToml"
  | "fromToml"
  | "toSql"
  | "toOpenApi"
  | "b64enc"
  | "b64dec"
  | "jwt"
  | "urlEnc"
  | "urlDec"
  | "escape"
  | "unescape"
  | "uuids"
  | "jsonPatch"
  | "mergePatch";

const TOOLS: Array<{ id: ToolId; label: string; group: string }> = [
  { id: "pretty", label: "Format / Pretty", group: "Format" },
  { id: "minify", label: "Minify", group: "Format" },
  { id: "sortKeys", label: "Sort keys", group: "Format" },
  { id: "sortArrays", label: "Sort arrays (primitives)", group: "Format" },
  { id: "snake", label: "Keys → snake_case", group: "Case" },
  { id: "camel", label: "Keys → camelCase", group: "Case" },
  { id: "pascal", label: "Keys → PascalCase", group: "Case" },
  { id: "upper", label: "Keys → UPPER", group: "Case" },
  { id: "lower", label: "Keys → lower", group: "Case" },
  { id: "flatten", label: "Flatten", group: "Structure" },
  { id: "unflatten", label: "Unflatten", group: "Structure" },
  { id: "jsonPatch", label: "Apply JSON Patch (doc = {doc,patch})", group: "Structure" },
  { id: "mergePatch", label: "Apply Merge Patch (doc = {doc,patch})", group: "Structure" },
  { id: "toCsv", label: "JSON → CSV", group: "Convert" },
  { id: "fromCsv", label: "CSV → JSON", group: "Convert" },
  { id: "toYaml", label: "JSON → YAML", group: "Convert" },
  { id: "fromYaml", label: "YAML → JSON", group: "Convert" },
  { id: "toXml", label: "JSON → XML", group: "Convert" },
  { id: "fromXml", label: "XML → JSON", group: "Convert" },
  { id: "toToml", label: "JSON → TOML", group: "Convert" },
  { id: "fromToml", label: "TOML → JSON", group: "Convert" },
  { id: "toSql", label: "JSON → SQL INSERTs", group: "Convert" },
  { id: "toOpenApi", label: "JSON → OpenAPI stub", group: "Convert" },
  { id: "b64enc", label: "Base64 encode (text)", group: "Encode" },
  { id: "b64dec", label: "Base64 decode", group: "Encode" },
  { id: "jwt", label: "JWT decode", group: "Encode" },
  { id: "urlEnc", label: "URL encode", group: "Encode" },
  { id: "urlDec", label: "URL decode", group: "Encode" },
  { id: "escape", label: "Escape JSON string", group: "Encode" },
  { id: "unescape", label: "Unescape JSON string", group: "Encode" },
  { id: "uuids", label: "Fill empty *id/uuid fields", group: "Generate" },
];

export function ToolsDrawer({
  open,
  onClose,
  value,
  onApply,
  mobile = false,
}: {
  open: boolean;
  onClose: () => void;
  value: string;
  onApply: (next: string, notice: string) => void;
  mobile?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const groups = useMemo(() => {
    const m = new Map<string, typeof TOOLS>();
    for (const t of TOOLS) {
      if (!m.has(t.group)) m.set(t.group, []);
      m.get(t.group)!.push(t);
    }
    return m;
  }, []);

  if (!open) return null;

  function run(id: ToolId) {
    setError(null);
    try {
      let next = value;
      switch (id) {
        case "pretty":
          next = prettyPrint(value);
          break;
        case "minify":
          next = minifyJson(value);
          break;
        case "sortKeys":
          next = sortJsonKeys(value);
          break;
        case "sortArrays":
          next = JSON.stringify(sortArraysDeep(JSON.parse(value)), null, 2);
          break;
        case "snake":
          next = JSON.stringify(mapKeysDeep(JSON.parse(value), toSnake), null, 2);
          break;
        case "camel":
          next = JSON.stringify(mapKeysDeep(JSON.parse(value), toCamel), null, 2);
          break;
        case "pascal":
          next = JSON.stringify(mapKeysDeep(JSON.parse(value), toPascal), null, 2);
          break;
        case "upper":
          next = JSON.stringify(mapKeysDeep(JSON.parse(value), (k) => k.toUpperCase()), null, 2);
          break;
        case "lower":
          next = JSON.stringify(mapKeysDeep(JSON.parse(value), (k) => k.toLowerCase()), null, 2);
          break;
        case "flatten":
          next = JSON.stringify(flattenJson(JSON.parse(value)), null, 2);
          break;
        case "unflatten":
          next = JSON.stringify(unflattenJson(JSON.parse(value) as Record<string, unknown>), null, 2);
          break;
        case "jsonPatch": {
          const envelope = JSON.parse(value) as { doc?: unknown; patch?: unknown };
          if (!envelope || typeof envelope !== "object" || !("doc" in envelope) || !("patch" in envelope)) {
            throw new Error('Expected { "doc": …, "patch": [ …ops ] }');
          }
          const ops = parsePatchDocument(JSON.stringify(envelope.patch));
          next = JSON.stringify(applyJsonPatch(envelope.doc, ops), null, 2);
          break;
        }
        case "mergePatch": {
          const envelope = JSON.parse(value) as { doc?: unknown; patch?: unknown };
          if (!envelope || typeof envelope !== "object" || !("doc" in envelope) || !("patch" in envelope)) {
            throw new Error('Expected { "doc": …, "patch": { … } }');
          }
          next = JSON.stringify(applyMergePatch(envelope.doc, envelope.patch), null, 2);
          break;
        }
        case "toCsv":
          next = jsonToCsv(JSON.parse(value));
          break;
        case "fromCsv":
          next = JSON.stringify(csvToJson(value), null, 2);
          break;
        case "toYaml":
          next = jsonToYaml(JSON.parse(value));
          break;
        case "fromYaml":
          next = JSON.stringify(yamlToJson(value), null, 2);
          break;
        case "toXml":
          next = jsonToXml(JSON.parse(value));
          break;
        case "fromXml":
          next = JSON.stringify(xmlToJson(value), null, 2);
          break;
        case "toToml":
          next = jsonToToml(JSON.parse(value));
          break;
        case "fromToml":
          next = JSON.stringify(tomlToJson(value), null, 2);
          break;
        case "toSql":
          next = jsonToSqlInsert(JSON.parse(value));
          break;
        case "toOpenApi":
          next = jsonToOpenApiStub(JSON.parse(value));
          break;
        case "b64enc":
          next = base64Encode(value);
          break;
        case "b64dec":
          next = base64Decode(value);
          break;
        case "jwt":
          next = JSON.stringify(decodeJwt(value.trim().replace(/^"|"$/g, "")), null, 2);
          break;
        case "urlEnc":
          next = urlEncode(value);
          break;
        case "urlDec":
          next = urlDecode(value);
          break;
        case "escape":
          next = escapeJsonString(value);
          break;
        case "unescape":
          next = unescapeJsonString(value);
          break;
        case "uuids":
          next = JSON.stringify(generateUuidsInPlace(JSON.parse(value)), null, 2);
          break;
      }
      onApply(next, TOOLS.find((t) => t.id === id)?.label ?? "Applied");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tool failed");
    }
  }

  if (!open) return null;

  const body = (
    <>
      {error && (
        <p className="mb-3 rounded-lg border border-red-900/40 bg-red-950/30 px-4 py-2 text-xs text-red-300">{error}</p>
      )}
      <div className={mobile ? "space-y-4" : "jb-scroll flex-1 overflow-y-auto p-3"}>
        {[...groups.entries()].map(([group, tools]) => (
          <div key={group}>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--jb-muted)]">{group}</p>
            <ul className={mobile ? "grid grid-cols-2 gap-2" : "space-y-1"}>
              {tools.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={
                      mobile
                        ? "jb-mobile-action-card w-full text-sm"
                        : "w-full rounded-md px-3 py-2 text-left text-sm text-[var(--jb-text)] hover:bg-[var(--jb-elevated)]"
                    }
                    onClick={() => run(t.id)}
                  >
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );

  if (mobile) {
    return (
      <BottomSheet open={open} onClose={onClose} title="Tools" tall>
        {body}
      </BottomSheet>
    );
  }

  return (
    <div className="fixed inset-0 z-[85] flex justify-end bg-black/40 backdrop-blur-[2px]">
      <button type="button" className="h-full flex-1" aria-label="Close tools" onClick={onClose} />
      <aside className="jb-scroll flex h-full w-full max-w-sm flex-col border-l border-[var(--jb-border)] bg-[var(--jb-panel)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--jb-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--jb-text)]">JSON Tools</h2>
          <button type="button" className="jb-action" onClick={onClose}>
            Close
          </button>
        </div>
        {body}
      </aside>
    </div>
  );
}
