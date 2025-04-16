// Comparison Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#comparison-expression-operators

import { ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";
import { $lte as __lte, processExpression } from "../../_predicates";

/**
 * Matches values that are less than or equal to the value specified in the query.
 */
export const $lte: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
) => processExpression(obj, expr, options, __lte);
