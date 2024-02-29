import { stringify } from "javascript-stringify";
import { type CodegenContext } from "#core/codegen/codegen.js";
import {
  type DataModel,
  type DataModelField,
  type DataModelModel,
  type DataModelScalarField,
} from "#core/dataModel/types.js";
import { isJsonField } from "#core/fingerprint/fingerprint.js";
import { type Fingerprint } from "#core/fingerprint/types.js";
import { generateCodeFromTemplate } from "#core/userModels/templates/codegen.js";
import { type Templates } from "#core/userModels/templates/types.js";
import { type UserModels } from "#core/userModels/types.js";
import { type Shape, type TableShapePredictions } from "#trpc/shapes.js";
import { generateJsonField } from "./generateJsonField.js";

export const SHAPE_PREDICTION_CONFIDENCE_THRESHOLD = 0.65;

const findEnumType = (dataModel: DataModel, field: DataModelField) =>
  Object.entries(dataModel.enums).find(
    ([enumName]) => enumName === field.type,
  )?.[1];

const generateDefaultForField = (props: {
  dataModel: DataModel;
  field: DataModelField;
  fieldShapeExamples: Array<string> | null;
  fingerprint: Fingerprint[string][string] | null;
  shape: Shape | null;
  templates: Templates;
}) => {
  const {
    field,
    dataModel,
    shape,
    fingerprint,
    fieldShapeExamples,
    templates,
  } = props;

  const matchEnum = findEnumType(dataModel, field);

  if (matchEnum) {
    return `({ seed }) => copycat.oneOf(seed, ${JSON.stringify(
      matchEnum.values.map((v) => v.name),
    )})`;
  }

  if (fingerprint && isJsonField(fingerprint)) {
    const result = generateJsonField(fingerprint);
    return `({ seed }) => { return ${result}; }`;
  }

  if (field.kind !== "scalar") {
    return null;
  }

  if (shape && fieldShapeExamples !== null) {
    if (field.maxLength) {
      return `({ seed }) => copycat.oneOfString(seed, getExamples('${shape}'), { limit: ${JSON.stringify(field.maxLength)} })`;
    } else {
      return `({ seed }) => copycat.oneOfString(seed, getExamples('${shape}'))`;
    }
  }

  const code = generateCodeFromTemplate(
    "seed",
    field.type,
    field.maxLength ?? null,
    shape,
    templates,
  );
  return `({ seed, options }) => { return ${code} }`;
};

const generateDefaultsForModel = (props: {
  dataModel: DataModel;
  fingerprint: Fingerprint[string] | null;
  model: DataModelModel;
  shapeExamples: Array<{ examples: Array<string>; shape: string }>;
  shapePredictions: TableShapePredictions | null;
  templates: Templates;
}) => {
  const { fingerprint, model, dataModel, shapePredictions, templates } = props;

  const fields: { data: NonNullable<UserModels[string]["data"]> } = {
    data: {},
  };

  const scalarFields = model.fields.filter(
    (f) => f.kind === "scalar",
  ) as Array<DataModelScalarField>;

  for (const field of scalarFields) {
    const prediction = shapePredictions?.predictions.find((prediction) => {
      return (
        prediction.column === field.columnName &&
        prediction.shape != null &&
        prediction.confidence != null &&
        prediction.confidence > SHAPE_PREDICTION_CONFIDENCE_THRESHOLD
      );
    });

    let fieldShapeExamples = null;
    let shape: Shape | null = null;

    if (prediction) {
      shape = prediction.shape ?? null;
      fieldShapeExamples =
        props.shapeExamples.find((e) => e.shape === prediction.shape)
          ?.examples ?? null;
    }

    const fieldFingerprint = fingerprint?.[field.name] ?? null;

    // If the field is both a sequence and id, its default value must be null
    // so we can overide it with the sequence generator in the plan
    if (field.isId && field.sequence) {
      fields.data[field.name] = null;
    } else {
      fields.data[field.name] = generateDefaultForField({
        field,
        dataModel,
        shape,
        fieldShapeExamples,
        fingerprint: fieldFingerprint,
        templates,
      });
    }
  }
  return fields;
};

export const generateDefaultsForModels = (props: {
  dataModel: DataModel;
  fingerprint: Fingerprint;
  shapeExamples: Array<{ examples: Array<string>; shape: string }>;
  shapePredictions: Array<TableShapePredictions>;
  templates: Templates;
}) => {
  const { fingerprint, dataModel, shapePredictions, templates } = props;
  const models: UserModels = {};

  for (const [modelName, model] of Object.entries(dataModel.models)) {
    const modelShapePredictions =
      shapePredictions.find(
        (predictions) =>
          model.tableName === predictions.tableName &&
          model.schemaName === predictions.schemaName,
      ) ?? null;

    const modelFingerprint = fingerprint[modelName] ?? null;

    models[modelName] = generateDefaultsForModel({
      model,
      dataModel,
      shapePredictions: modelShapePredictions,
      shapeExamples: props.shapeExamples,
      fingerprint: modelFingerprint,
      templates,
    });
  }

  return models;
};

export const generateUserModels = (context: CodegenContext) => {
  const { fingerprint, dataModel, shapePredictions, shapeExamples, templates } =
    context;

  const defaults = generateDefaultsForModels({
    dataModel,
    shapePredictions,
    shapeExamples,
    fingerprint,
    templates,
  });

  const stringifiedDefaults =
    stringify(
      defaults,
      (value, _indent, recur) => {
        if (value === null) {
          return "null";
        }

        if (typeof value === "string") {
          return value;
        }

        return recur(value);
      },
      "  ",
    ) ?? "";
  return `
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { copycat } from "@snaplet/copycat"

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const shapeExamples = JSON.parse(readFileSync(path.join(__dirname, "shapeExamples.json")));

const getExamples = (shape) => shapeExamples.find((e) => e.shape === shape)?.examples ?? [];

export const modelDefaults = ${stringifiedDefaults};
`;
};
