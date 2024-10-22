// Arithmetic Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#arithmetic-expression-operators

import { computeValue, ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";
import { assert, isDate } from "../../../util";

/**
 * Computes the sum of an array of numbers.
 *
 * @param obj
 * @param expr
 * @returns {AnyObject}
 */
export const $add: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
): number | Date => {
  const args = computeValue(obj, expr, null, options) as Any[];
  let foundDate = false;
  const result = args.reduce((acc: number, val: Any) => {
    if (isDate(val)) {
      assert(!foundDate, "'$add' can only have one date value");
      foundDate = true;
      val = val.getTime();
    }
    // assume val is a number
    acc += val as number;
    return acc;
  }, 0) as number;
  return foundDate ? new Date(result) : result;
};
