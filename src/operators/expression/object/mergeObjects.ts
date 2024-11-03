// Object Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#object-expression-operators

import { computeValue, ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject } from "../../../types";
import { into, isArray } from "../../../util";

/**
 * Combines multiple documents into a single document.
 *
 * @param {*} obj The target object for this expression
 * @param {*} expr The right-hand side of the operator
 * @param {Options} options Options to use for operation
 */
export const $mergeObjects: ExpressionOperator<AnyObject> = (
  obj: AnyObject,
  expr: Any,
  options: Options
): AnyObject => {
  const docs = computeValue(obj, expr, null, options) as AnyObject[];
  return isArray(docs)
    ? docs.reduce((memo, o) => into(memo, o) as AnyObject, {})
    : {};
};
