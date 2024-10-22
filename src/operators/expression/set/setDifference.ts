/**
 * Set Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#set-expression-operators
 */

import { computeValue, ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";
import { notInArray } from "../../../util";

/**
 * Returns elements of a set that do not appear in a second set.
 * @param obj
 * @param expr
 */
export const $setDifference: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
): Any => {
  const args = computeValue(obj, expr, null, options) as Any[][];
  return args[0].filter(v => notInArray(args[1], v));
};
