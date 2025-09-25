import { AggregatorImpl } from "../src/aggregator/_internal";
import { Context, initOptions, Options, UpdateOptions } from "../src/core";
import { Cursor } from "../src/cursor";
import fullContext from "../src/init/context";
import { Source } from "../src/lazy";
import { QueryImpl } from "../src/query/_internal";
import { AnyObject } from "../src/types";
import { createUpdater as createUpdaterInternal } from "../src/updater";

export { Context, ProcessingMode } from "../src/core";

const context = fullContext();
const makeOpts = (options?: Partial<Options>) => {
  const opts = initOptions(options);
  return { ...opts, context: Context.merge(context, opts.context) };
};

export class Query extends QueryImpl {
  constructor(condition: AnyObject, options?: Partial<Options>) {
    super(condition, makeOpts(options));
  }
}

export class Aggregator extends AggregatorImpl {
  constructor(pipeline: AnyObject[], options?: Partial<Options>) {
    super(pipeline, makeOpts(options));
  }
}

export const createUpdater = (defaultOptions?: UpdateOptions) =>
  createUpdaterInternal({
    ...defaultOptions,
    queryOptions: makeOpts(defaultOptions?.queryOptions)
  });

export const update = createUpdater();

export const aggregate = (
  collection: Source,
  pipeline: AnyObject[],
  options?: Partial<Options>
): AnyObject[] => new Aggregator(pipeline, options).run(collection);

export const find = <T>(
  collection: Source,
  criteria: AnyObject,
  projection?: AnyObject,
  options?: Partial<Options>
): Cursor<T> => new Query(criteria, options).find<T>(collection, projection);
