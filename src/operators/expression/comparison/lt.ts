import { ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";
import { $lt as __lt, processExpression } from "../../_predicates";

/**
 * Matches values that are less than the value specified in the query.
 */
export const $lt: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
) => processExpression(obj, expr, options, __lt);
