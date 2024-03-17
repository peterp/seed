import { flatten } from "remeda";
import { type Json } from "#core/data/types.js";

export const isNestedArrayPgType = (pgType: string): boolean =>
  pgType.startsWith("_") || pgType.endsWith("[]");

type Serializer = (v: Json) => string;

type Serializers = Partial<Record<JsTypeName, Serializer>>;

const SERIALIZERS: Serializers = {
  string: String,
  number: String,
  boolean: (v) => (v ? "t" : "f"),
  Json: (v) => JSON.stringify(v),
};

export const getPgTypeArrayDimensions = (pgType: string): number => {
  if (pgType.startsWith("_")) {
    return 1;
  }

  return pgType.split("[]").length - 1;
};

const JS_TO_PG_TYPES = {
  string: [
    "bpchar",
    "character_data",
    "varchar",
    "text",
    "character",
    "character varying",
    "inet",
    "cidr",
    "point",
    "lseg",
    "path",
    "box",
    "line",
    "circle",
    "macaddr",
    "macaddr8",
    "interval",
    "tsquery",
    "tsvector",
    "pg_lsn",
    "xml",
    "bit",
    "varbit",
    "bit varying",
    "uuid",
    "bytea",
    "money",
    "smallmoney",
    "datetime",
    "timestamp",
    "date",
    "time",
    "timetz",
    "timestamptz",
    "datetime2",
    "smalldatetime",
    "datetimeoffset",
    "citext",
  ],
  number: [
    "tinyint",
    "int",
    "numeric",
    "integer",
    "real",
    "smallint",
    "decimal",
    "float",
    "float4",
    "float8",
    "double precision",
    "double",
    "dec",
    "fixed",
    "year",
    "smallserial",
    "serial",
    "serial2",
    "serial4",
    "serial8",
    "bigserial",
    "int2",
    "int4",
    "int8",
    "int16",
    "int32",
    "bigint",
  ],
  boolean: ["boolean", "bool"],
  Json: ["json", "jsonb", "TVP"],
  Buffer: ["binary", "varbinary", "image", "UDT"],
} as const;
type JsToPgTypes = typeof JS_TO_PG_TYPES;
type NonNullableJsTypeName = keyof JsToPgTypes;
type JsTypeName = "null" | NonNullableJsTypeName;
export type PgTypeName = JsToPgTypes[NonNullableJsTypeName][number];

export const PG_TO_JS_TYPES: Record<PgTypeName, JsTypeName> =
  Object.fromEntries(
    flatten(
      Object.entries(JS_TO_PG_TYPES).map(([jsType, pgTypes]) =>
        pgTypes.map((pgType) => [pgType, jsType]),
      ),
    ),
  ) as Record<PgTypeName, JsTypeName>;

export const extractPrimitivePgType = (pgType: string): PgTypeName => {
  if (isNestedArrayPgType(pgType)) {
    if (pgType.startsWith("_")) {
      return pgType.slice(1) as PgTypeName;
    } else {
      return pgType.replaceAll("[]", "") as PgTypeName;
    }
  }

  return pgType as PgTypeName;
};

const serializeArrayColumn = (value: Json, pgType: string): string => {
  const arrayDimension = getPgTypeArrayDimensions(pgType);
  const jsType = PG_TO_JS_TYPES[extractPrimitivePgType(pgType)];

  if (value === null) {
    return "NULL";
  }

  if (arrayDimension === 0 && jsType === "Json") {
    return JSON.stringify(JSON.stringify(value));
  }

  if (Array.isArray(value)) {
    const openingBracket = arrayDimension > 0 ? "{" : "[";
    const closingBracket = arrayDimension > 0 ? "}" : "]";
    const nextPgType = arrayDimension > 0 ? pgType.slice(0, -2) : pgType;
    return [
      openingBracket,
      value.map((v) => serializeArrayColumn(v, nextPgType)).join(","),
      closingBracket,
    ].join("");
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!jsType) {
    return JSON.stringify(String(value));
  }

  const serializer = SERIALIZERS[jsType];

  const result = !serializer ? String(value) : serializer(value);

  return jsType === "string" ? JSON.stringify(result) : result;
};

export const serializeToSQL = (type: string, value: Json): Json => {
  if (isNestedArrayPgType(type)) {
    return serializeArrayColumn(value, type);
  }

  if (["json", "jsonb"].includes(type)) {
    return JSON.stringify(value);
  }

  return value;
};

/**
 * From https://github.com/brianc/pg/blob/2a8efbee09a284be12748ed3962bc9b816965e36/packages/pg/lib/utils.js#L175-L202
 */
export const escapeIdentifier = function (str: string) {
  return '"' + str.replace(/"/g, '""') + '"';
};
export const escapeLiteral = function (str: string) {
  var hasBackslash = false;
  var escaped = "'";

  // eslint-disable-next-line @typescript-eslint/prefer-for-of
  for (var i = 0; i < str.length; i++) {
    var c = str[i];
    if (c === "'") {
      escaped += c + c;
    } else if (c === "\\") {
      escaped += c + c;
      hasBackslash = true;
    } else {
      escaped += c;
    }
  }

  escaped += "'";

  if (hasBackslash) {
    escaped = " E" + escaped;
  }

  return escaped;
};

export const PG_DATE_TYPES = new Set([
  "datetime",
  "timestamp",
  "date",
  "timestamptz",
  "datetime2",
  "smalldatetime",
  "datetimeoffset",
]);

export const PG_JSON_TYPES = new Set(["json", "jsonb", "TVP"]);

export const PG_NUMBER_TYPES = new Set([
  "tinyint",
  "int",
  "numeric",
  "integer",
  "real",
  "smallint",
  "decimal",
  "float",
  "float4",
  "float8",
  "double precision",
  "double",
  "dec",
  "fixed",
  "year",
  "smallserial",
  "serial",
  "serial2",
  "serial4",
  "serial8",
  "bigserial",
  "int2",
  "int4",
  "int8",
  "int16",
  "int32",
  "bigint",
]);

export function groupBy<T, K extends number | string | symbol>(
  array: Array<T>,
  getKey: (item: T) => K,
) {
  const result: Record<K, Array<T> | undefined> = {} as Record<
    K,
    Array<T> | undefined
  >;
  return array.reduce((accumulator, currentItem) => {
    const key = getKey(currentItem);
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key]?.push(currentItem);
    return accumulator;
  }, result);
}
