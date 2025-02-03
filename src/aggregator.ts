import {
  DefaultOptions,
  getOperator,
  Options,
  PipelineOperator,
  ProcessingMode
} from "./core";
import { Iterator, Lazy, Source } from "./lazy";
import { AnyObject } from "./types";
import { assert, cloneDeep, intersection, isEmpty } from "./util";

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
    this.#options = new DefaultOptions(options);
  }

  /**
   * Returns an {@link Iterator} for lazy evaluation of the pipeline.
   *
   * @param {*} collection An array or iterator object
   * @returns {Iterator} an iterator object
   */
  stream(collection: Source, options?: Options): Iterator {
    let iterator: Iterator = Lazy(collection);
    const opts = options ?? this.#options;
    const mode = opts.processingMode;

    if (
      mode == ProcessingMode.CLONE_ALL ||
      mode == ProcessingMode.CLONE_INPUT
    ) {
      iterator.map(cloneDeep);
    }

    const stages = new Array<string>();

    if (!isEmpty(this.#pipeline)) {
      // run aggregation pipeline
      for (const operator of this.#pipeline) {
        const operatorKeys = Object.keys(operator);
        const opName = operatorKeys[0];
        const call = getOperator("pipeline", opName, opts) as PipelineOperator;

        assert(
          operatorKeys.length === 1 && !!call,
          `invalid pipeline operator ${opName}`
        );
        stages.push(opName);
        iterator = call(iterator, operator[opName], opts);
      }
    }

    // operators that may share object graphs of inputs.
    // we only need to clone the output for these since the objects will already be distinct for other operators.
    if (
      mode == ProcessingMode.CLONE_OUTPUT ||
      (mode == ProcessingMode.CLONE_ALL &&
        !!intersection([["$group", "$unwind"], stages]).length)
    ) {
      iterator.map(cloneDeep);
    }

    return iterator;
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
