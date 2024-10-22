import { Aggregator } from "../../aggregator";
import { Options, PipelineOperator, ProcessingMode } from "../../core";
import { Iterator } from "../../lazy";
import { AnyObject, Callback } from "../../types";

/**
 * Processes multiple aggregation pipelines within a single stage on the same set of input documents.
 * Enables the creation of multi-faceted aggregations capable of characterizing data across multiple dimensions, or facets, in a single stage.
 */
export const $facet: PipelineOperator = (
  collection: Iterator,
  expr: Record<string, AnyObject[]>,
  options: Options
): Iterator => {
  return collection.transform(((array: AnyObject[]) => {
    const o: AnyObject = {};
    for (const [k, pipeline] of Object.entries(expr)) {
      o[k] = new Aggregator(pipeline, {
        ...options,
        processingMode: ProcessingMode.CLONE_INPUT
      }).run(array);
    }
    return [o];
  }) as Callback<AnyObject[]>);
};
