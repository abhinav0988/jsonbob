export const SAMPLE_JSON = `{
  "array": [
    1,
    2,
    3
  ],
  "boolean": true,
  "null": null,
  "number": 123,
  "object": {
    "a": "b",
    "c": "d",
    "e": "f"
  },
  "string": "Hello World"
}`;

export const EMPTY_JSON = "{\n  \n}";

export function prettyPrint(text: string) {
  return JSON.stringify(JSON.parse(text), null, 2);
}

export function minifyJson(text: string) {
  return JSON.stringify(JSON.parse(text));
}

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function sortJsonKeys(text: string) {
  return JSON.stringify(sortKeysDeep(JSON.parse(text)), null, 2);
}
