import { Options, PipelineOperator } from "../../core";
import { Iterator } from "../../lazy";
import { Any, AnyObject } from "../../types";
import { $group } from "./group";
import { $sort } from "./sort";

/**
 * Groups incoming documents based on the value of a specified expression,
 * then computes the count of documents in each distinct group.
 *
 * https://docs.mongodb.com/manual/reference/operator/aggregation/sortByCount/
 *
 * @param  {Array} collection
 * @param  {AnyObject} expr
 * @param  {AnyObject} options
 * @return {*}
 */
export const $sortByCount: PipelineOperator = (
  collection: Iterator,
  expr: Any,
  options: Options
): Iterator => {
  const newExpr: AnyObject = { count: { $sum: 1 } };

  newExpr["_id"] = expr;

  return $sort($group(collection, newExpr, options), { count: -1 }, options);
};
