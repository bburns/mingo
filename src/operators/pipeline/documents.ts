import {
  computeValue,
  Options,
  PipelineOperator,
  ProcessingMode
} from "../../core";
import { Iterator, Lazy } from "../../lazy";
import { Any } from "../../types";
import { assert, cloneDeep, isArray } from "../../util";

/**
 * Returns literal documents from input values.
 *
 * See {@link https://www.mongodb.com/docs/manual/reference/operator/aggregation/documents/ usage}.
 *
 * @param collection
 * @param expr
 * @param options
 * @returns
 */
export const $documents: PipelineOperator = (
  _: Iterator,
  expr: Any,
  options: Options
): Iterator => {
  const docs = computeValue(null, expr, null, options);
  assert(isArray(docs), "$documents: expression must resolve to an array.");
  const iter = Lazy(docs as Any[]);
  const mode = options.processingMode;
  return mode & ProcessingMode.CLONE_ALL ? iter.map(cloneDeep) : iter;
};
