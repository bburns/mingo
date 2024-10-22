import { AccumulatorOperator, Options } from "../../core";
import { Any, AnyObject } from "../../types";
import { $mergeObjects as __mergeObjects } from "../expression/object/mergeObjects";

/**
 * Combines multiple documents into a single document.
 *
 * @param {Array} collection The input array
 * @param {AnyObject} _ The right-hand side expression value of the operator
 * @param {Options} options The options to use for this operation
 * @returns {Array|*}
 */
export const $mergeObjects: AccumulatorOperator = (
  collection: AnyObject[],
  _: Any,
  options: Options
): AnyObject => __mergeObjects({ docs: collection }, "$docs", options);
