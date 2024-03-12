import { type DataModelField } from "./types.js";

export const shouldGenerateFieldValue = (field: DataModelField): boolean => {
  if (field.kind !== "scalar") {
    return false;
  }

  // * If field is a generated non-id field, it is always generated by the database
  // * If the field is both a sequence and id, its default value must be null so we can overide it
  //   with the sequence generator in the plan
  if ((!field.isId && field.isGenerated) || (field.isId && field.sequence)) {
    return false;
  }

  return true;
};