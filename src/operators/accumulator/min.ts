import { AccumulatorOperator, Options } from "../../core";
import { Any, AnyObject } from "../../types";
import { compare, isNotNaN } from "../../util";
import { $push } from "./push";

/**
 * Returns the lowest value in a group.
 *
 * @param {Array} collection The input array
 * @param {AnyObject} expr The right-hand side expression value of the operator
 * @param {Options} The options to use for this operator
 * @returns {*}
 */
export const $min: AccumulatorOperator = (
  collection: AnyObject[],
  expr: Any,
  options: Options
): Any => {
  const nums = $push(collection, expr, options).filter(isNotNaN) as number[];
  const n = nums.reduce((acc, n) => (compare(n, acc) <= 0 ? n : acc), Infinity);
  return n === Infinity ? undefined : n;
};
