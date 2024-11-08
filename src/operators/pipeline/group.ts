import {
  ComputeOptions,
  computeValue,
  getOperator,
  OperatorType,
  Options,
  PipelineOperator
} from "../../core";
import { Iterator, Source } from "../../lazy";
import { Any, AnyObject, Callback } from "../../types";
import { assert, groupBy, has, MingoError } from "../../util";

// lookup key for grouping
const ID_KEY = "_id";

/**
 * Groups documents together for the purpose of calculating aggregate values based on a collection of documents.
 *
 * @param collection
 * @param expr
 * @param options
 * @returns {Any[]}
 */
export const $group: PipelineOperator = (
  collection: Iterator,
  expr: AnyObject,
  options: Options
): Iterator => {
  assert(has(expr, ID_KEY), "a group specification must include an _id");
  const idExpr = expr[ID_KEY];
  const copts = ComputeOptions.init(options);

  // store new fields (key -> accumulatorWithArgs)
  const newFields = new Array<[string, (_1: Any, _2: Options) => Any]>();
  for (const [key, val] of Object.entries(expr)) {
    if (key === ID_KEY) continue;
    // validate new fields sub-expression
    const entry = Object.entries(val) as [string, Any][];
    assert(
      entry.length === 1,
      `invalid $group accumulator expression for field ${key}.`
    );
    const [opName, opArgs] = entry[0];
    // validate operator
    const accumulatorFn = getOperator(
      OperatorType.ACCUMULATOR,
      opName,
      options
    ) as Callback<Any>;
    if (accumulatorFn) {
      // store pre-cached accumulator function
      newFields.push([key, (xs, opts) => accumulatorFn(xs, opArgs, opts)]);
      continue;
    }
    const expressionFn = getOperator(
      OperatorType.EXPRESSION,
      opName,
      options
    ) as Callback<Any>;
    if (expressionFn) {
      newFields.push([key, (xs, opts) => expressionFn(xs, opArgs, opts)]);
      continue;
    }
    throw new MingoError(`operator not registered: ${opName}`);
  }

  return collection.transform(((coll: Any[]) => {
    const partitions = groupBy(
      coll,
      obj => computeValue(obj, idExpr, null, options),
      options.hashFunction
    );

    let i = -1;
    const partitionKeys = Array.from(partitions.keys());
    const size = partitions.size;

    return () => {
      if (++i === size) return { done: true };

      const groupId = partitionKeys[i];
      const obj: AnyObject = {};

      // exclude undefined key value
      if (groupId !== undefined) {
        obj[ID_KEY] = groupId;
      }

      // compute remaining keys in expression
      for (const [key, fn] of newFields) {
        obj[key] = fn(partitions.get(groupId), copts.update(null, { groupId }));
      }

      return { value: obj, done: false };
    };
  }) as Callback<Source>);
};
