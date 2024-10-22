// Array Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#array-expression-operators

import {
  ComputeOptions,
  computeValue,
  ExpressionOperator,
  Options
} from "../../../core";
import { Any, AnyObject } from "../../../types";
import { assert, isArray, isNil } from "../../../util";
import { $first as __first } from "../../accumulator";

/**
 * Returns the first element in an array.
 *
 * @param  {AnyObject} obj
 * @param  {*} expr
 * @return {*}
 */
export const $first: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
): Any => {
  const copts = ComputeOptions.init(options);
  if (obj instanceof Array) return __first(obj, expr, copts.update());

  const arr = computeValue(obj, expr, null, options) as AnyObject[];
  if (isNil(arr)) return null;
  assert(isArray(arr), "Must resolve to an array/null or missing");
  return __first(arr, "$$this", options);
};
