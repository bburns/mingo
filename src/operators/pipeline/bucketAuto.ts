import { computeValue, Options, PipelineOperator } from "../../core";
import { Iterator } from "../../lazy";
import { Any, AnyObject } from "../../types";
import { assert, has, into, isNil, memoize, sortBy } from "../../util";

interface Boundary extends AnyObject {
  min?: number;
  max?: number;
}

interface InoutExpr {
  groupBy: Any;
  buckets: number;
  output?: AnyObject;
  granularity: string;
}

const ID_KEY = "_id";

/**
 * Categorizes incoming documents into a specific number of groups, called buckets, based on a specified expression.
 * Bucket boundaries are automatically determined in an attempt to evenly distribute the documents into the specified number of buckets.
 *
 * See {@link https://docs.mongodb.com/manual/reference/operator/aggregation/bucketAuto/ usage}.
 *
 * @param collection
 * @param expr
 * @param options
 * @returns
 */
export const $bucketAuto: PipelineOperator = (
  collection: Iterator,
  expr: InoutExpr,
  options: Options
): Iterator => {
  const outputExpr = expr.output || { count: { $sum: 1 } };
  const groupByExpr = expr.groupBy;
  const bucketCount = expr.buckets;

  assert(
    bucketCount > 0,
    `The $bucketAuto 'buckets' field must be greater than 0, but found: ${bucketCount}`
  );

  return collection.transform((coll: AnyObject[]) => {
    const approxBucketSize = Math.max(1, Math.round(coll.length / bucketCount));
    const computeValueOptimized = memoize(computeValue, options?.hashFunction);
    const grouped = new Map<Any, Any[]>();
    const remaining: Any[] = [];

    const sorted = sortBy(coll, o => {
      const key = computeValueOptimized(o, groupByExpr, null, options);
      if (isNil(key)) {
        remaining.push(o);
      } else {
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(o);
      }
      return key;
    });

    const result: AnyObject[] = [];
    let index = 0; // counter for sorted collection

    for (let i = 0, len = sorted.length; i < bucketCount && index < len; i++) {
      const boundaries: Boundary = {};
      const bucketItems: Any[] = [];

      for (let j = 0; j < approxBucketSize && index < len; j++) {
        let key = computeValueOptimized(
          sorted[index],
          groupByExpr,
          null,
          options
        ) as number;

        if (isNil(key)) key = null;

        // populate current bucket with all values for current key
        into(bucketItems, isNil(key) ? remaining : grouped.get(key));

        // increase sort index by number of items added
        index += isNil(key) ? remaining.length : grouped.get(key).length;

        // set the min key boundary if not already present
        if (!has(boundaries, "min")) boundaries.min = key;

        if (result.length > 0) {
          const lastBucket = result[result.length - 1] as Record<
            string,
            Boundary
          >;
          lastBucket[ID_KEY].max = boundaries.min;
        }
      }

      // if is last bucket add remaining items
      if (i == bucketCount - 1) {
        into(bucketItems, sorted.slice(index));
      }

      const values = computeValue(
        bucketItems,
        outputExpr,
        null,
        options
      ) as AnyObject;

      result.push(
        into(values, {
          _id: boundaries
        }) as AnyObject
      );
    }

    if (result.length > 0) {
      (result[result.length - 1][ID_KEY] as Boundary).max =
        computeValueOptimized(
          sorted[sorted.length - 1],
          groupByExpr,
          null,
          options
        ) as number;
    }

    return result;
  });
};
