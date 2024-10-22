// Comparison Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#comparison-expression-operators

import { computeValue, ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";

/**
 * Compares two values and returns the result of the comparison as an integer.
 *
 * @param obj
 * @param expr
 * @returns {number}
 */
export const $cmp: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
): Any => {
  const args = computeValue(obj, expr, null, options);
  if (args[0] > args[1]) return 1;
  if (args[0] < args[1]) return -1;
  return 0;
};
