import { computeValue, Options } from "../../../core";
import { Any, Callback } from "../../../types";

/**
 * Allows the use of aggregation expressions within the query language.
 */
export function $expr(
  _: string,
  rhs: Any,
  options: Options
): Callback<boolean> {
  return obj => computeValue(obj, rhs, null, options) as boolean;
}
