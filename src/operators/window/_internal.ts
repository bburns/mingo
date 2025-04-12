import { Options } from "../../core";
import {
  Any,
  AnyObject,
  Callback,
  TimeUnit,
  WindowOperatorInput
} from "../../types";
import { groupBy, isEqual, MingoError } from "../../util";
import { $push } from "../accumulator";
import { MILLIS_PER_DAY } from "../expression/date/_internal";

export type WindowTimeUnit = Exclude<TimeUnit, "year" | "quarter" | "month">;

// millis map to diffirent time units
export const MILLIS_PER_UNIT: Record<WindowTimeUnit, number> = {
  week: MILLIS_PER_DAY * 7,
  day: MILLIS_PER_DAY,
  hour: MILLIS_PER_DAY / 24,
  minute: 60000,
  second: 1000,
  millisecond: 1
};

// internal cache to store precomputed series once to avoid O(N^2) calls over the collection
const memo = new WeakMap<Any[], AnyObject>();

/** used for testing only. check that the collection and optional key is cached */
export const cached = (xs: AnyObject[]) => memo.has(xs);

/**
 * A utility function that manages memoization for window operators.
 * It caches intermediate results for a given collection and field,
 * and ensures proper cleanup after processing.
 *
 * @template T - The type of the cached value.
 * @template R - The return type of the callback function.
 * @param collection - The collection of documents being processed.
 * @param expr - The window operator input containing metadata such as the field name and document number.
 * @param initialize - A callback function that computes and returns the cached value for the field.
 * @param fn - A callback function that processes the cached value and returns the result.
 * @returns The result of the `fn` callback function.
 * @throws Any errors thrown by the `fn` callback function.
 */
export function withMemo<T = Any, R = Any>(
  collection: AnyObject[],
  expr: Pick<WindowOperatorInput, "field" | "documentNumber">,
  initialize: Callback<T>,
  fn: Callback<R, T>
): R {
  // add collection to working memory
  if (!memo.has(collection)) {
    memo.set(collection, {});
  }
  const data = memo.get(collection);
  // cache the computation for the field
  if (!(expr.field in data)) {
    data[expr.field] = initialize();
  }

  let ok = false;
  try {
    const res = fn(data[expr.field] as T);
    ok = true;
    return res;
  } finally {
    // cleanup on failure
    if (!ok) {
      memo.delete(collection);
    } else if (expr.documentNumber === collection.length) {
      // cleanup on last document
      delete data[expr.field];
      if (Object.keys(data).length === 0) memo.delete(collection);
    }
  }
}

/** Returns the position of a document in the $setWindowFields stage partition. */
export function rank(
  _: AnyObject,
  collection: AnyObject[],
  expr: WindowOperatorInput,
  options: Options,
  dense: boolean
): Any {
  return withMemo<{ values: Any[]; groups: Map<Any, Any[]> }, number>(
    collection,
    expr,
    () => {
      const sortKey = "$" + Object.keys(expr.parentExpr.sortBy)[0];
      const values = $push(collection, sortKey, options);
      const groups = groupBy(
        values,
        ((_: AnyObject, n: number) => values[n]) as Callback,
        options.hashFunction
      );
      return { values, groups };
    },
    input => {
      const { values, groups: partitions } = input;
      // same number of paritions as length means all sort keys are unique
      if (partitions.size == collection.length) {
        return expr.documentNumber;
      }

      const current = values[expr.documentNumber - 1];

      let i = 0;
      let offset = 0;
      // partition keys are already dense so just return the value on match
      for (const key of partitions.keys()) {
        if (isEqual(current, key)) {
          return dense ? i + 1 : offset + 1;
        }
        i++;
        offset += partitions.get(key).length;
      }
      // should be unreachable
      throw new MingoError(
        "rank: invalid return value. please submit a bug report."
      );
    }
  );
}
