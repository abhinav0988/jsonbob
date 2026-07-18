/** Lightweight JSON Schema (draft-07+) validator for Problems panel — production coverage of common keywords. */

export type SchemaIssue = {
  path: string;
  message: string;
};

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema | JsonSchema[];
  enum?: unknown[];
  const?: unknown;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  additionalProperties?: boolean | JsonSchema;
  patternProperties?: Record<string, JsonSchema>;
  propertyNames?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  contains?: JsonSchema;
  not?: JsonSchema;
  if?: JsonSchema;
  then?: JsonSchema;
  else?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  $ref?: string;
  definitions?: Record<string, JsonSchema>;
  $defs?: Record<string, JsonSchema>;
};

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function matchesType(value: unknown, expected: string | string[]): boolean {
  const types = Array.isArray(expected) ? expected : [expected];
  const actual = typeOf(value);
  return types.some((t) => {
    if (t === "integer") return typeof value === "number" && Number.isInteger(value);
    return t === actual;
  });
}

function resolveRef(root: JsonSchema, ref: string): JsonSchema | null {
  if (!ref.startsWith("#/")) return null;
  const parts = ref.slice(2).split("/");
  let cur: unknown = root;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur && typeof cur === "object" ? (cur as JsonSchema) : null;
}

function validateNode(
  value: unknown,
  schema: JsonSchema,
  path: string,
  root: JsonSchema,
  out: SchemaIssue[],
) {
  let effective = schema;
  if (schema.$ref) {
    const resolved = resolveRef(root, schema.$ref);
    if (!resolved) {
      out.push({ path, message: `Unresolved $ref ${schema.$ref}` });
      return;
    }
    effective = { ...resolved, ...schema, $ref: undefined };
  }

  if (effective.allOf) {
    for (const sub of effective.allOf) validateNode(value, sub, path, root, out);
  }
  if (effective.anyOf) {
    const before = out.length;
    let ok = false;
    for (const sub of effective.anyOf) {
      const local: SchemaIssue[] = [];
      validateNode(value, sub, path, root, local);
      if (local.length === 0) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      out.length = before;
      out.push({ path, message: "Does not match anyOf" });
    }
  }
  if (effective.oneOf) {
    let matches = 0;
    for (const sub of effective.oneOf) {
      const local: SchemaIssue[] = [];
      validateNode(value, sub, path, root, local);
      if (local.length === 0) matches += 1;
    }
    if (matches !== 1) {
      out.push({ path, message: `Expected exactly one of oneOf (got ${matches})` });
    }
  }

  if (effective.not) {
    const local: SchemaIssue[] = [];
    validateNode(value, effective.not, path, root, local);
    if (local.length === 0) out.push({ path, message: "Must not match `not` schema" });
  }

  if (effective.if) {
    const local: SchemaIssue[] = [];
    validateNode(value, effective.if, path, root, local);
    if (local.length === 0 && effective.then) {
      validateNode(value, effective.then, path, root, out);
    } else if (local.length > 0 && effective.else) {
      validateNode(value, effective.else, path, root, out);
    }
  }

  if (effective.type && !matchesType(value, effective.type)) {
    out.push({
      path,
      message: `Expected type ${Array.isArray(effective.type) ? effective.type.join("|") : effective.type}, got ${typeOf(value)}`,
    });
    return;
  }

  if (effective.const !== undefined && JSON.stringify(value) !== JSON.stringify(effective.const)) {
    out.push({ path, message: `Expected const ${JSON.stringify(effective.const)}` });
  }

  if (effective.enum && !effective.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) {
    out.push({ path, message: `Value not in enum` });
  }

  if (typeof value === "number") {
    if (effective.minimum !== undefined && value < effective.minimum) {
      out.push({ path, message: `Must be ≥ ${effective.minimum}` });
    }
    if (effective.maximum !== undefined && value > effective.maximum) {
      out.push({ path, message: `Must be ≤ ${effective.maximum}` });
    }
    if (typeof effective.exclusiveMinimum === "number" && value <= effective.exclusiveMinimum) {
      out.push({ path, message: `Must be > ${effective.exclusiveMinimum}` });
    }
    if (typeof effective.exclusiveMaximum === "number" && value >= effective.exclusiveMaximum) {
      out.push({ path, message: `Must be < ${effective.exclusiveMaximum}` });
    }
    if (effective.multipleOf !== undefined && effective.multipleOf > 0) {
      const q = value / effective.multipleOf;
      if (Math.abs(q - Math.round(q)) > 1e-10) {
        out.push({ path, message: `Must be multiple of ${effective.multipleOf}` });
      }
    }
  }

  if (typeof value === "string") {
    if (effective.minLength !== undefined && value.length < effective.minLength) {
      out.push({ path, message: `String shorter than minLength ${effective.minLength}` });
    }
    if (effective.maxLength !== undefined && value.length > effective.maxLength) {
      out.push({ path, message: `String longer than maxLength ${effective.maxLength}` });
    }
    if (effective.pattern) {
      try {
        if (!new RegExp(effective.pattern).test(value)) {
          out.push({ path, message: `Does not match pattern /${effective.pattern}/` });
        }
      } catch {
        out.push({ path, message: `Invalid schema pattern` });
      }
    }
    if (effective.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      out.push({ path, message: "Invalid email format" });
    }
    if (effective.format === "uri") {
      try {
        void new URL(value);
      } catch {
        out.push({ path, message: "Invalid uri format" });
      }
    }
    if (effective.format === "uuid" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      out.push({ path, message: "Invalid uuid format" });
    }
    if (effective.format === "date-time" && Number.isNaN(Date.parse(value))) {
      out.push({ path, message: "Invalid date-time format" });
    }
  }

  if (Array.isArray(value)) {
    if (effective.minItems !== undefined && value.length < effective.minItems) {
      out.push({ path, message: `Array shorter than minItems ${effective.minItems}` });
    }
    if (effective.maxItems !== undefined && value.length > effective.maxItems) {
      out.push({ path, message: `Array longer than maxItems ${effective.maxItems}` });
    }
    if (effective.uniqueItems) {
      const seen = new Set(value.map((v) => JSON.stringify(v)));
      if (seen.size !== value.length) out.push({ path, message: "Items must be unique" });
    }
    if (effective.contains) {
      const ok = value.some((item) => {
        const local: SchemaIssue[] = [];
        validateNode(item, effective.contains!, path, root, local);
        return local.length === 0;
      });
      if (!ok) out.push({ path, message: "Array must contain a matching item" });
    }
    if (effective.items) {
      if (Array.isArray(effective.items)) {
        effective.items.forEach((itemSchema, i) => {
          if (i < value.length) {
            validateNode(value[i], itemSchema, `${path}[${i}]`, root, out);
          }
        });
      } else {
        value.forEach((item, i) => {
          validateNode(item, effective.items as JsonSchema, `${path}[${i}]`, root, out);
        });
      }
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (effective.required) {
      for (const key of effective.required) {
        if (!(key in obj)) {
          const child =
            path === "$"
              ? `$.${key}`
              : /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
                ? `${path}.${key}`
                : `${path}[${JSON.stringify(key)}]`;
          out.push({ path: child, message: `Missing required property "${key}"` });
        }
      }
    }
    if (effective.propertyNames) {
      for (const key of Object.keys(obj)) {
        validateNode(key, effective.propertyNames, `${path}.propertyName`, root, out);
      }
    }
    const props = effective.properties ?? {};
    const patterns = effective.patternProperties ?? {};
    for (const [key, childVal] of Object.entries(obj)) {
      const child =
        path === "$"
          ? /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
            ? `$.${key}`
            : `$[${JSON.stringify(key)}]`
          : /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
            ? `${path}.${key}`
            : `${path}[${JSON.stringify(key)}]`;
      if (key in props) {
        validateNode(childVal, props[key]!, child, root, out);
        continue;
      }
      let matchedPattern = false;
      for (const [pat, schema] of Object.entries(patterns)) {
        try {
          if (new RegExp(pat).test(key)) {
            matchedPattern = true;
            validateNode(childVal, schema, child, root, out);
          }
        } catch {
          /* ignore bad pattern */
        }
      }
      if (matchedPattern) continue;
      if (effective.additionalProperties === false) {
        out.push({ path: child, message: `Unexpected property "${key}"` });
      } else if (effective.additionalProperties && typeof effective.additionalProperties === "object") {
        validateNode(childVal, effective.additionalProperties, child, root, out);
      }
    }
  }
}

export function parseSchemaText(text: string): { ok: true; schema: JsonSchema } | { ok: false; error: string } {
  try {
    const schema = JSON.parse(text) as JsonSchema;
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      return { ok: false, error: "Schema must be a JSON object" };
    }
    return { ok: true, schema };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid schema JSON" };
  }
}

export function validateAgainstSchema(data: unknown, schema: JsonSchema): SchemaIssue[] {
  const out: SchemaIssue[] = [];
  validateNode(data, schema, "$", schema, out);
  return out;
}
