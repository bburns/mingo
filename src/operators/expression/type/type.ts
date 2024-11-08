/**
 * Type Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#type-expression-operators
 */

import { computeValue, ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";
import { isNumber, MAX_INT, MIN_INT, typeOf } from "../../../util";

export const $type: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
): string => {
  const v = computeValue(obj, expr, null, options);
  if (options.useStrictMode) {
    if (v === undefined) return "missing";
    if (v === true || v === false) return "bool";
    if (isNumber(v)) {
      if (v % 1 != 0) return "double";
      return v >= MIN_INT && v <= MAX_INT ? "int" : "long";
    }
  }
  return typeOf(v);
};
