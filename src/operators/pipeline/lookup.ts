import { Options, PipelineOperator } from "../../core";
import { Iterator } from "../../lazy";
import { AnyVal, RawObject } from "../../types";
import { assert, isString, resolve, ValueMap } from "../../util";

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
  assert(joinColl instanceof Array, `'from' field must resolve to an array`);

  const m = ValueMap.init<AnyVal, RawObject[]>(options.hashFunction);
  for (const obj of joinColl) {
    const foreign = resolve(obj, expr.foreignField) ?? null;
    const arr = m.get(foreign) || [];
    if (arr.length === 0) m.set(foreign, arr);
    arr.push(obj);
  }

  return collection.map((obj: RawObject) => {
    const local = resolve(obj, expr.localField) ?? null;
    return { ...obj, [expr.as]: m.get(local) || [] };
  });
};
