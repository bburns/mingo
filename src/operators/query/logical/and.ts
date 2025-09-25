import { Options, QueryOperator } from "../../../core";
import { QueryImpl } from "../../../query/_internal";
import { AnyObject, Callback } from "../../../types";
import { assert, isArray } from "../../../util";

/**
 * Joins query clauses with a logical AND returns all documents that match the conditions of both clauses.
 *
 * @param selector
 * @param rhs
 * @returns {Function}
 */
export const $and: QueryOperator = (
  _: string,
  rhs: AnyObject[],
  options: Options
): Callback<boolean> => {
  assert(
    isArray(rhs),
    "Invalid expression: $and expects value to be an Array."
  );
  const queries = rhs.map(expr => new QueryImpl(expr, options));
  return (obj: AnyObject) => queries.every(q => q.test(obj));
};
