/**
 * String Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#string-expression-operators
 */

import { computeValue, ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";
import { inArray } from "../../../util";

/**
 * Concatenates two strings.
 *
 * @param obj
 * @param expr
 * @returns {string|*}
 */
export const $concat: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
): Any => {
  const args = computeValue(obj, expr, null, options) as Any[];
  // does not allow concatenation with nulls
  if (([null, undefined] as Any[]).some(v => inArray(args, v))) return null;
  return args.join("");
};
