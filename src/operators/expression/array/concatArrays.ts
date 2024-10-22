// Array Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#array-expression-operators

import { computeValue, ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";
import { assert, into, isArray, isNil } from "../../../util";

/**
 * Concatenates arrays to return the concatenated array.
 *
 * @param  {AnyObject} obj
 * @param  {*} expr
 * @return {*}
 */
export const $concatArrays: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
): Any => {
  const arr = computeValue(obj, expr, null, options) as Any[];
  assert(isArray(arr), "$concatArrays must resolve to an array");

  if (arr.some(isNil)) return null;
  return arr.reduce((acc: Any[], item: Any[]) => into(acc, item), []);
};
