import * as z from "zod";

type JsonPrimitive = boolean | null | number | string;
type Nested<V> = { [s: string]: Nested<V> | V } | Array<Nested<V> | V> | V;
type Json = Nested<JsonPrimitive>;

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]),
);

const scalarFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
});

const objectFieldSchema = z.intersection(
  scalarFieldSchema,
  z.object({
    relationFromFields: z.array(z.string()),
    relationToFields: z.array(z.string()),
  }),
);

const oppositeBaseNameMapSchema = z.record(z.string(), z.string());

export interface InflectionStrategy {
  childField?: (
    field: {
      name: string;
      relationFromFields: Array<string>;
      relationToFields: Array<string>;
      type: string;
    },
    oppositeField: {
      name: string;
      relationFromFields: Array<string>;
      relationToFields: Array<string>;
      type: string;
    },
    oppositeBaseNameMap: Record<string, string>,
  ) => string;
  modelName?: (name: string) => string;
  oppositeBaseNameMap?: Record<string, string>;
  parentField?: (
    field: {
      name: string;
      relationFromFields: Array<string>;
      relationToFields: Array<string>;
      type: string;
    },
    oppositeBaseNameMap: Record<string, string>,
  ) => string;
  scalarField?: (field: { name: string; type: string }) => string;
}

export const aliasConfigSchema = z.object({
  inflection: z
    .union([
      z.object({
        modelName: z.function().args(z.string()).returns(z.string()).optional(),
        scalarField: z
          .function()
          .args(scalarFieldSchema)
          .returns(z.string())
          .optional(),
        parentField: z
          .function()
          .args(objectFieldSchema, oppositeBaseNameMapSchema)
          .returns(z.string())
          .optional(),
        childField: z
          .function()
          .args(objectFieldSchema, objectFieldSchema, oppositeBaseNameMapSchema)
          .returns(z.string())
          .optional(),
        oppositeBaseNameMap: oppositeBaseNameMapSchema.optional(),
      }),
      z.boolean(),
    ])
    .optional()
    .default(false),
  override: z
    .record(
      z.string(),
      z.object({
        name: z.string().optional(),
        fields: z.record(z.string(), z.string()).optional(),
      }),
    )
    .optional(),
});
