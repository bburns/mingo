// Arithmetic Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#arithmetic-expression-operators

import { isDate } from "util/types";

import { computeValue, ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";
import { assert, isNumber } from "../../../util";

/**
 * Takes an array that contains two numbers or two dates and subtracts the second value from the first.
 *
 * @param obj
 * @param expr
 * @returns {number}
 */
export const $subtract: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
): Any => {
  const args = computeValue(obj, expr, null, options) as Any[];
  assert(
    args.every(n => isNumber(n) || isDate(n)),
    "$substrat operands must resolve to number or date."
  );
  const foundDate = args.some(isDate);
  const [a, b] = args;
  return foundDate ? new Date(+a - +b) : +a - +b;
};
