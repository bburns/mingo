import { Options, PipelineOperator } from "../../core";
import { Iterator } from "../../lazy";
import { AnyObject } from "../../types";
import { assert, cloneDeep, isString } from "../../util";

/**
 * Takes the documents returned by the aggregation pipeline and writes them to a specified collection.
 *
 * Unlike the $out operator in MongoDB, this operator can appear in any position in the pipeline and is
 * useful for collecting intermediate results of an aggregation operation.
 *
 * Note: Object are deep cloned for outputing regardless of the ProcessingMode.
 *
 * @param collection
 * @param expr
 * @param options
 * @returns {*}
 */
export const $out: PipelineOperator = (
  collection: Iterator,
  expr: string | AnyObject[],
  options: Options
): Iterator => {
  const outputColl: AnyObject[] = isString(expr)
    ? options?.collectionResolver(expr)
    : expr;
  assert(outputColl instanceof Array, `expression must resolve to an array`);

  return collection.map((o: AnyObject) => {
    outputColl.push(cloneDeep(o) as AnyObject);
    return o; // passthrough
  });
};
