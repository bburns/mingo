/**
 * Type Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#type-expression-operators
 */

import { computeValue, ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";
import { typeOf } from "../../../util";

export const $type: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
): string => typeOf(computeValue(obj, expr, null, options));
