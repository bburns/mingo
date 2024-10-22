/**
 * Set Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#set-expression-operators
 */

import { computeValue, ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";
import { intersection, unique } from "../../../util";

/**
 * Returns true if two sets have the same elements.
 * @param obj
 * @param expr
 */
export const $setEquals: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
): Any => {
  const args = computeValue(obj, expr, null, options) as Any[][];
  const xs = unique(args[0], options?.hashFunction);
  const ys = unique(args[1], options?.hashFunction);
  return (
    xs.length === ys.length &&
    xs.length === intersection([xs, ys], options?.hashFunction).length
  );
};
