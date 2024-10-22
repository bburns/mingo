import { Options, PipelineOperator } from "../../core";
import { Iterator } from "../../lazy";
import { Query } from "../../query";
import { AnyObject } from "../../types";

/**
 * Filters the document stream, and only allows matching documents to pass into the next pipeline stage.
 * $match uses standard MongoDB queries.
 *
 * @param collection
 * @param expr
 * @param options
 * @returns {Array|*}
 */
export const $match: PipelineOperator = (
  collection: Iterator,
  expr: AnyObject,
  options: Options
): Iterator => {
  const q = new Query(expr, options);
  return collection.filter((o: AnyObject) => q.test(o));
};
