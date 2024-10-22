import { Options, PipelineOperator } from "../../core";
import { Iterator } from "../../lazy";
import { AnyVal, RawArray, RawObject } from "../../types";
import {
  assert,
  ensureArray,
  flatten,
  isArray,
  isString,
  resolve,
  unique,
  ValueMap
} from "../../util";

/**
 * Performs a left outer join to another collection in the same database to filter in documents from the “joined” collection for processing.
 *
 * See {@link https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/}
 *
 * @param collection
 * @param expr
 * @param opt
 */
export const $lookup: PipelineOperator = (
  collection: Iterator,
  expr: {
    from: string | RawObject[];
    localField: string;
    foreignField: string;
    as: string;
  },
  options: Options
): Iterator => {
  const joinColl = isString(expr.from)
    ? options?.collectionResolver(expr.from)
    : expr.from;
  assert(isArray(joinColl), "$lookup: 'from' must resolve to an array.");

  const map = ValueMap.init<AnyVal, RawArray>(options.hashFunction);
  for (const obj of joinColl) {
    // add object for each value in the array.
    ensureArray(resolve(obj, expr.foreignField) ?? null).forEach(v => {
      const arr = map.get(v) ?? [];
      arr.push(obj);
      map.set(v, arr);
    });
  }

  return collection.map((obj: RawObject) => {
    const local = resolve(obj, expr.localField) ?? null;
    // if array local field is an array, flatten and get unique values to avoid duplicates
    // from storing an object for each array member from the join collection.
    const asValue = isArray(local)
      ? unique(flatten(local.map(v => map.get(v), options.hashFunction)))
      : map.get(local);
    return { ...obj, [expr.as]: asValue };
  });
};
