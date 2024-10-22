import { AccumulatorOperator, computeValue, Options } from "../../core";
import { Any, AnyObject } from "../../types";

/**
 * Returns the first value in a group.
 *
 * @param {Array} collection The input array
 * @param {AnyObject} expr The right-hand side expression value of the operator
 * @returns {*}
 */
export const $first: AccumulatorOperator = (
  collection: AnyObject[],
  expr: Any,
  options: Options
): Any => {
  return collection.length > 0
    ? computeValue(collection[0], expr, null, options)
    : undefined;
};
