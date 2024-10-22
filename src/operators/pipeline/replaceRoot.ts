import { computeValue, Options, PipelineOperator } from "../../core";
import { Iterator } from "../../lazy";
import { AnyObject } from "../../types";
import { assert, isObject } from "../../util";

/**
 * Replaces a document with the specified embedded document or new one.
 * The replacement document can be any valid expression that resolves to a document.
 *
 * https://docs.mongodb.com/manual/reference/operator/aggregation/replaceRoot/
 *
 * @param  {Iterator} collection
 * @param  {AnyObject} expr
 * @param  {AnyObject} options
 * @return {*}
 */
export const $replaceRoot: PipelineOperator = (
  collection: Iterator,
  expr: AnyObject,
  options: Options
): Iterator => {
  return collection.map(obj => {
    obj = computeValue(obj, expr.newRoot, null, options);
    assert(isObject(obj), "$replaceRoot expression must return an object");
    return obj;
  });
};
