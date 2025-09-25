import { Options, PipelineOperator } from "../../core";
import { Iterator } from "../../lazy";
import { QueryImpl } from "../../query/_internal";
import { AnyObject } from "../../types";

/**
 * Filters the document stream to allow only matching documents to pass unmodified into the next pipeline stage.
 *
 * See {@link https://www.mongodb.com/docs/manual/reference/operator/aggregation/match usage}.
 *
 * @param collection
 * @param expr
 * @param options
 * @returns
 */
export const $match: PipelineOperator = (
  collection: Iterator,
  expr: AnyObject,
  options: Options
): Iterator => {
  const q = new QueryImpl(expr, options);
  return collection.filter((o: AnyObject) => q.test(o));
};
