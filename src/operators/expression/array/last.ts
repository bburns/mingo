// Array Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#array-expression-operators

import {
  ComputeOptions,
  computeValue,
  ExpressionOperator,
  Options
} from "../../../core";
import { Any, AnyObject } from "../../../types";
import { assert, isArray, isNil } from "../../../util";
import { $last as __last } from "../../accumulator";

/**
 * Returns the last element in an array.
 *
 * @param  {AnyObject} obj
 * @param  {*} expr
 * @return {*}
 */
export const $last: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
): Any => {
  const copts = ComputeOptions.init(options);
  if (isArray(obj)) return __last(obj, expr, copts.update());

  const arr = computeValue(obj, expr, null, options) as AnyObject[];
  if (isNil(arr)) return null;
  assert(isArray(arr), "Must resolve to an array/null or missing");
  return __last(arr, "$$this", options);
};
