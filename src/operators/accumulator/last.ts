import { AccumulatorOperator, computeValue, Options } from "../../core";
import { Any, AnyObject } from "../../types";

/**
 * Returns the last value in the collection.
 *
 * @param {Array} collection The input array
 * @param {AnyObject} expr The right-hand side expression value of the operator
 * @param {Options} options The options to use for this operation
 * @returns {*}
 */
export const $last: AccumulatorOperator = (
  collection: AnyObject[],
  expr: Any,
  options: Options
): Any => {
  return collection.length > 0
    ? computeValue(collection[collection.length - 1], expr, null, options)
    : undefined;
};
