import { computeValue, Options, PipelineOperator } from "../../core";
import { Iterator } from "../../lazy";
import { AnyObject, Callback } from "../../types";
import { removeValue, setValue } from "../../util";

/**
 * Adds new fields to documents.
 * Outputs documents that contain all existing fields from the input documents and newly added fields.
 *
 * @param {Iterator} collection
 * @param {AnyObject} expr
 * @param {Options} options
 */
export const $addFields: PipelineOperator = (
  collection: Iterator,
  expr: AnyObject,
  options: Options
): Iterator => {
  const newFields = Object.keys(expr);

  if (newFields.length === 0) return collection;

  return collection.map(((obj: AnyObject) => {
    const newObj = { ...obj };
    for (const field of newFields) {
      const newValue = computeValue(obj, expr[field], null, options);
      if (newValue !== undefined) {
        setValue(newObj, field, newValue);
      } else {
        removeValue(newObj, field);
      }
    }
    return newObj;
  }) as Callback<AnyObject>);
};
