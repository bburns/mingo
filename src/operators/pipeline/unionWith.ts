import { Aggregator } from "../../aggregator";
import { Options, PipelineOperator } from "../../core";
import { concat, Iterator, Lazy } from "../../lazy";
import { RawObject } from "../../types";
import { isString } from "../../util";

interface InputExpr {
  readonly coll: RawObject[];
  readonly pipeline?: RawObject[];
}

/**
 * Performs a union of two collections.
 *
 * @param collection
 * @param expr
 * @param opt
 */
export const $unionWith: PipelineOperator = (
  collection: Iterator,
  expr: InputExpr,
  options: Options
): Iterator => {
  const array = isString(expr.coll)
    ? options.collectionResolver(expr.coll)
    : expr.coll;

  const iterators = [collection];
  iterators.push(
    expr.pipeline
      ? new Aggregator(expr.pipeline, options).stream(array)
      : Lazy(array)
  );

  return concat(...iterators);
};
