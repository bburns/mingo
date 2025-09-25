import { ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";
import { $substr } from "./substr";

export const $substrCP: ExpressionOperator = (
  obj: AnyObject,
  expr: Any,
  options: Options
): Any => {
  return $substr(obj, expr, options);
};
