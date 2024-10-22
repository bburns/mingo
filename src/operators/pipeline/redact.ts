import { ComputeOptions, Options, PipelineOperator, redact } from "../../core";
import { Iterator } from "../../lazy";
import { AnyObject, Callback } from "../../types";

/**
 * Restricts the contents of the documents based on information stored in the documents themselves.
 *
 * https://docs.mongodb.com/manual/reference/operator/aggregation/redact/
 */
export const $redact: PipelineOperator = (
  collection: Iterator,
  expr: AnyObject,
  options: Options
): Iterator => {
  const copts = ComputeOptions.init(options);
  return collection.map(((obj: AnyObject) =>
    redact(obj, expr, copts.update(obj))) as Callback);
};
