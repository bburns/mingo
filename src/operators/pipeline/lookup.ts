import { Options, PipelineOperator } from "../../core";
import { Iterator } from "../../lazy";
import { Any, AnyObject } from "../../types";
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

interface EqualityLookupExpr {
  /** Specifies the collection in the same database to perform the join with. */
  from: string | AnyObject[];
  /** Specifies the field from the documents input to the $lookup stage. */
  localField: string;
  /** Specifies the field from the documents in the from collection. */
  foreignField: string;
  /** Specifies the name of the new array field to add to the input documents. */
  as: string;
}

// TODO: https://github.com/kofrasa/mingo/issues/471
// interface SubQueryLookupExpr {
//   /** Specifies the collection in the same database to perform the join operation. */
//   from: string | AnyObject[];
//   /** Optional. Specifies variables to use in the pipeline stages. */
//   let?: RawObject;
//   /** Specifies the pipeline to run on the joined collection. The pipeline determines the resulting documents from the joined collection. */
//   pipeline: Record<`$${string}`, AnyVal>[];
//   /** Specifies the name of the new array field to add to the joined documents. */
//   as: string;
// }

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
  expr: EqualityLookupExpr,
  options: Options
): Iterator => {
  const joinColl = isString(expr.from)
    ? options?.collectionResolver(expr.from)
    : expr.from;

  assert(isArray(joinColl), "$lookup: 'from' must resolve to an array.");
  const { localField, foreignField, as: asField } = expr;

  const map = ValueMap.init<Any, Any[]>(options.hashFunction);
  for (const obj of joinColl) {
    // add object for each value in the array.
    ensureArray(resolve(obj, foreignField) ?? null).forEach(v => {
      const arr = map.get(v) ?? [];
      arr.push(obj);
      map.set(v, arr);
    });
  }

  return collection.map((obj: AnyObject) => {
    const local = resolve(obj, localField) ?? null;
    // if array local field is an array, flatten and get unique values to avoid duplicates
    // from storing an object for each array member from the join collection.
    const asValue = isArray(local)
      ? unique(flatten(local.map(v => map.get(v), options.hashFunction)))
      : map.get(local);
    return { ...obj, [asField]: asValue };
  });
};
