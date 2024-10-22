/**
 * Set Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#set-expression-operators
 */

import { computeValue, ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";
import { ValueMap } from "../../../util";

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
  const m = ValueMap.init(options.hashFunction);
  args[0].forEach(v => m.set(v, true));
  args[1].forEach(v => m.delete(v));
  return Array.from(m.keys());
};
