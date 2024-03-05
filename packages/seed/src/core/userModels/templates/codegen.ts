import { type Shape } from "#trpc/shapes.js";
import {
  type TemplateContext,
  type TemplateFn,
  type TemplateInput,
  type Templates,
} from "./types.js";

type NestedType = string;

export const unpackNestedType = <Type extends string>(
  type: NestedType | Type,
): [Type, number] => {
  const [primitive, ...rest] = type.split("[]");
  return [primitive as Type, rest.length];
};

export const generateCodeFromTemplate = <Type extends string>(
  input: TemplateInput,
  wrappedType: NestedType | Type,
  maxLength: null | number,
  shape: Shape | null,
  templates: Templates,
) => {
  // todo(justinvdm, 28 Feb 2024): Bring back array support
  // https://linear.app/snaplet/issue/S-1901/bring-back-array-support-for-templates

  const [type, dimensions] = unpackNestedType<Type>(wrappedType);

  const context: TemplateContext = {
    input,
    type,
    maxLength,
    shape,
  };

  let result: null | string = null;
  const shapeTemplates = templates[type];

  if (shapeTemplates == null) {
    result = null;
  } else if (typeof shapeTemplates === "function") {
    result = shapeTemplates(context);
  } else {
    let fn: TemplateFn | null | undefined;

    if (shape == null || shapeTemplates[shape] == null) {
      fn = shapeTemplates.__DEFAULT ?? null;
    } else {
      fn = shapeTemplates[shape];
    }

    if (fn != null) {
      result = fn(context);
    }
  }

  return result != null ? encloseValueInArray(result, dimensions) : null;
};

function encloseValueInArray(value: string, dimensions: number) {
  if (dimensions === 0) {
    return value;
  }

  return Array(dimensions)
    .fill(undefined)
    .reduce<string>((acc) => `[${acc}]`, value);
}
