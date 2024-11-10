// Array Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#array-expression-operators

import {
  ComputeOptions,
  computeValue,
  ExpressionOperator,
  Options
} from "../../../core";
import { Any, AnyObject } from "../../../types";
import { assert, flatten, isArray, isNil } from "../../../util";
import { $last as __last } from "../../accumulator/last";

/**
 * Returns the last element in an array.
 */
export const $last: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
): Any => {
  if (isArray(obj))
    return __last(obj, expr, ComputeOptions.init(options).update());
  const arr = computeValue(obj, expr, null, options) as AnyObject[];
  if (isNil(arr)) return null;
  assert(
    isArray(arr) && arr.length > 0,
    "$last must resolve to a non-empty array."
  );
  return flatten(arr)[arr.length - 1];
};
