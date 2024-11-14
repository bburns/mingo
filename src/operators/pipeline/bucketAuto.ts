import { computeValue, Options, PipelineOperator } from "../../core";
import { Iterator, Lazy } from "../../lazy";
import { Any, AnyObject, Callback } from "../../types";
import {
  assert,
  compare,
  isArray,
  isEqual,
  isNil,
  isNumber,
  memoize
} from "../../util";

type Granularity =
  | "E6"
  | "E12"
  | "E24"
  | "E48"
  | "E96"
  | "E192"
  | "R5"
  | "R10"
  | "R20"
  | "R40"
  | "R80"
  | "POWERSOF2"
  | "1-2-5";

interface InputExpr {
  /** An expression to group documents by. */
  groupBy: Any;
  /** A positive 32-bit integer that specifies the number of buckets into which input documents are grouped. */
  buckets: number;
  /** A document that specifies the fields to include in the output documents in addition to the _id field. */
  output?: AnyObject;
  /** A string that specifies the preferred number series to use to ensure that the calculated boundary edges end on preferred round numbers or their powers of 10. */
  granularity?: Granularity;
}

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
  expr: InputExpr,
  options: Options
): Iterator => {
  const {
    buckets: bucketCount,
    groupBy: groupByExpr,
    output: optOutputExpr,
    // Available only if the all groupBy values are numeric and none of them are NaN.
    granularity
  } = expr;

  const outputExpr = optOutputExpr ?? { count: { $sum: 1 } };

  assert(
    bucketCount > 0,
    `$bucketAuto: 'buckets' field must be greater than 0, but found: ${bucketCount}`
  );

  if (granularity) {
    assert(
      /^POWERSOF2|1-2-5|E(6|12|24|48|96|192)|R(5|10|20|40|80)$/.test(
        granularity
      ),
      `$bucketAuto: invalid granularity '${granularity}'.`
    );
  }

  const getKey = memoize(computeValue, options?.hashFunction);
  const sorted = collection
    .map((o: AnyObject) => {
      const k = getKey(o, groupByExpr, null, options) ?? null;
      assert(
        !granularity || isNumber(k),
        "$bucketAuto: groupBy values must be numeric when granularity is specified."
      );
      return [k ?? null, o];
    })
    .value();

  sorted.sort((x, y) => {
    if (isNil(x[0])) return -1;
    if (isNil(y[0])) return 1;
    return compare(x[0], y[0]);
  });

  const getNext =
    granularity == "POWERSOF2"
      ? granularityPowerOfTwo(sorted as Array<[number, AnyObject]>, bucketCount)
      : granularityDefault(
          sorted as Array<[number, AnyObject]>,
          bucketCount,
          groupByExpr,
          getKey,
          options
        );

  let terminate = false;

  return Lazy(() => {
    if (terminate) return { done: true };

    const { min, max, bucket, done } = getNext();

    terminate = done;

    const outFields = computeValue(
      bucket,
      outputExpr,
      null,
      options
    ) as AnyObject;

    // remove nil entries from arrays
    for (const [k, v] of Object.entries(outFields)) {
      if (isArray(v)) outFields[k] = v.filter(v => v !== undefined);
    }

    return {
      done: false,
      value: {
        ...outFields,
        _id: { min, max }
      }
    };
  });
};

function granularityDefault(
  sorted: Array<[Any, AnyObject]>,
  bucketCount: number,
  groupByExpr: Any,
  getKey: (o: Any, _expr: Any, _op: string, _opts: Options) => Any,
  options: Options
): Callback<{ min: Any; max: Any; bucket: AnyObject[]; done: boolean }> {
  const size = sorted.length;
  const approxBucketSize = Math.max(1, Math.round(sorted.length / bucketCount));
  let index = 0;
  let nBuckets = 0;

  return () => {
    const isLastBucket = ++nBuckets == bucketCount;
    const bucket = new Array<AnyObject>();

    for (let j = 0; j < approxBucketSize && index < size; j++) {
      bucket.push(sorted[index++][1]);
    }

    // add items with the same key into the same bucket OR
    // all remaining items if this is the last bucket.
    while (
      index < size &&
      (isLastBucket || isEqual(sorted[index - 1][0], sorted[index][0]))
    ) {
      bucket.push(sorted[index++][1]);
    }

    const min = getKey(bucket[0], groupByExpr, null, options) ?? null;
    let max: Any;
    // The _id.max field specifies the upper bound for the bucket.
    // This bound is exclusive for all buckets except the final bucket in the series, where it is inclusive.
    if (index < size) {
      // the min of next bucket.
      max = sorted[index][0];
    } else {
      max = getKey(bucket[bucket.length - 1], groupByExpr, null, options);
    }

    assert(
      isNil(max) || isNil(min) || min <= max,
      `error: $bucketAuto boundary must be in order.`
    );

    return {
      min,
      max,
      bucket,
      done: index >= size
    };
  };
}

function granularityPowerOfTwo(
  sorted: Array<[number, AnyObject]>,
  bucketCount: number
): Callback<{ min: number; max: number; bucket: AnyObject[]; done: boolean }> {
  const size = sorted.length;
  const approxBucketSize = Math.max(1, Math.round(sorted.length / bucketCount));
  // round up to the next power of 2 in the series.
  const roundUp = (n: number) =>
    n === 0 ? 0 : 2 ** (Math.floor(Math.log2(n)) + 1);

  let index = 0;
  let min = 0;
  let max = 0;

  return () => {
    const bucket = new Array<AnyObject>();
    const boundValue = roundUp(max);
    min = index > 0 ? max : 0;

    while (
      bucket.length < approxBucketSize &&
      index < size &&
      (max === 0 || sorted[index][0] < boundValue)
    ) {
      bucket.push(sorted[index++][1]);
    }

    // round up the last value of the current bucket if it is the first, otherwise use the boundValue
    max = max == 0 ? roundUp(sorted[index - 1][0]) : boundValue;

    // after adjusting the max, we could still have items that fall below it. add those items here.
    while (index < size && sorted[index][0] < max) {
      bucket.push(sorted[index++][1]);
    }

    return {
      min,
      max,
      bucket,
      done: index >= size
    };
  };
}
