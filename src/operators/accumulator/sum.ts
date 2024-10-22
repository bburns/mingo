import { AccumulatorOperator, Options } from "../../core";
import { Any, AnyObject } from "../../types";
import { isArray, isNumber } from "../../util";
import { $push } from "./push";

/**
 * Returns the sum of all the values in a group.
 *
 * @param {Array} collection The input array
 * @param {AnyObject} expr The right-hand side expression value of the operator
 * @returns {Number}
 */
export const $sum: AccumulatorOperator<number> = (
  collection: AnyObject[],
  expr: Any,
  options: Options
): number => {
  if (!isArray(collection)) return 0;

  // take a short cut if expr is number literal
  if (isNumber(expr)) return collection.length * expr;
  const nums = $push(collection, expr, options).filter(isNumber);
  return nums.reduce((acc, n) => acc + n, 0);
};
