/**
 * Set Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#set-expression-operators
 */

import { computeValue, ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";
import { assert, intersection, isArray } from "../../../util";

/**
 * Returns the common elements of the input sets.
 * @param obj
 * @param expr
 */
export const $setIntersection: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
): Any => {
  const args = computeValue(obj, expr, null, options) as Any[][];
  assert(
    isArray(args) && args.every(isArray),
    "$setIntersection: expresssion must resolve to array of arrays"
  );
  return intersection(args, options?.hashFunction);
};
