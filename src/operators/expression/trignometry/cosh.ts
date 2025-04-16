// Trignometry Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#trigonometry-expression-operators

import { ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";
import { processOperator } from "./_internal";

/** Returns the hyperbolic cosine of a value that is measured in radians. */
export const $cosh: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
): Any =>
  processOperator(obj, expr, options, Math.cosh, {
    "-Infinity": Infinity,
    Infinity: Infinity
  });
