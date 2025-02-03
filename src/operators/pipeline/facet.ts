import { Aggregator } from "../../aggregator";
import { Options, PipelineOperator } from "../../core";
import { Iterator, Lazy } from "../../lazy";
import { AnyObject, Callback } from "../../types";
import { cloneDeep } from "../../util";

/**
 * Processes multiple aggregation pipelines within a single stage on the same set of input documents.
 *
 * See {@link https://www.mongodb.com/docs/manual/reference/operator/aggregation/facet usage}.
 *
 * @param collection
 * @param expr
 * @param options
 * @returns
 */
export const $facet: PipelineOperator = (
  collection: Iterator,
  expr: Record<string, AnyObject[]>,
  options: Options
): Iterator => {
  return collection.transform(((array: AnyObject[]) => {
    const o: AnyObject = {};
    for (const [k, pipeline] of Object.entries(expr)) {
      o[k] = new Aggregator(pipeline, options)
        .stream(Lazy(array).map(cloneDeep))
        .value();
    }
    return [o];
  }) as Callback<AnyObject[]>);
};
