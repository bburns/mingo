import {
  getOperator,
  initOptions,
  Options,
  OpType,
  PipelineOperator,
  ProcessingMode
} from "./core";
import { Iterator, Lazy, Source } from "./lazy";
import { Any, AnyObject } from "./types";
import { assert, cloneDeep } from "./util";

/**
 * Provides functionality for the mongoDB aggregation pipeline
 *
 * @param pipeline an Array of pipeline operators
 * @param options An optional Options to pass the aggregator
 * @constructor
 */
export class Aggregator {
  #pipeline: AnyObject[];
  #options: Options;

  constructor(pipeline: AnyObject[], options?: Partial<Options>) {
    this.#pipeline = pipeline;
    this.#options = initOptions(options);
  }

  /**
   * Returns an {@link Iterator} for lazy evaluation of the pipeline.
   *
   * @param collection An array or iterator object
   * @returns {Iterator} an iterator object
   */
  stream(collection: Source, options?: Options): Iterator {
    let iter: Iterator = Lazy(collection);
    const opts = options ?? this.#options;
    const mode = opts.processingMode;

    // clone the input collection if requested.
    if (mode & ProcessingMode.CLONE_INPUT) iter.map(cloneDeep);

    // validate and build pipeline
    iter = this.#pipeline
      .map<[PipelineOperator, Any]>((stage, i) => {
        const keys = Object.keys(stage);
        assert(
          keys.length === 1,
          `aggregation stage must have single operator, got ${keys.toString()}.`
        );
        const name = keys[0];
        // may contain only one $documents operator which must be first in the pipeline.
        assert(
          name !== "$documents" || i == 0,
          "$documents must be first stage in pipeline."
        );
        const op = getOperator(OpType.PIPELINE, name, opts) as PipelineOperator;
        assert(!!op, `unregistered pipeline operator ${name}.`);
        return [op, stage[name]];
      })
      .reduce((acc, [op, expr]) => op(acc, expr, opts), iter);

    // operators that may share object graphs of inputs.
    if (mode & ProcessingMode.CLONE_OUTPUT) iter.map(cloneDeep);

    return iter;
  }

  /**
   * Return the results of the aggregation as an array.
   *
   * @param collection
   */
  run<T extends AnyObject>(collection: Source, options?: Options): T[] {
    return this.stream(collection, options).value();
  }
}
