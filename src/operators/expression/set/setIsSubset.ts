/**
 * Set Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#set-expression-operators
 */

import { computeValue, ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";
import { intersection } from "../../../util";

/**
 * Returns true if all elements of a set appear in a second set.
 * @param obj
 * @param expr
 */
export const $setIsSubset: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
): Any => {
  const args = computeValue(obj, expr, null, options) as Any[][];
  return intersection(args, options?.hashFunction).length === args[0].length;
};
