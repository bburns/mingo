import { computeValue, Options, PipelineOperator } from "../../core";
import { Iterator, Lazy } from "../../lazy";
import { Any, AnyObject } from "../../types";
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

// const GranularityRounder = {
//   POWEROFTWO: {
//     min: 0,
//     max: Math.log2(Number.MAX_SAFE_INTEGER),
//     up: (n: number) => Math.floor(Math.log2(n)) + 1,
//     down: (n: number) => Math.floor(Math.log2(n)) - 1
//   }
// };

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
      /^POWEROF2|1-2-5|E(6|12|24|48|96|192)|R(5|10|20|40|80)$/.test(
        granularity
      ),
      `$bucketAuto: invalid granularity '${granularity}'.`
    );
  }

  const getKey = memoize(computeValue, options?.hashFunction);
  const sorted = collection
    .map((o: Any) => {
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

  // const getNextBucketSize = (min: number, max: number): number => {
  //   if (!granularity) {
  //     return Math.max(1, Math.round(sorted.length / bucketCount));
  //   }
  //   if (granularity == "POWERSOF2") return Math.pow(2, bucketCount);
  //   if (granularity == "1-2-5") {
  //   }
  //   if (granularity[0] == "R") {
  //   }
  //   if (granularity[0] == "E") {
  //   }
  // };

  // const getNextBounds = (min: number, max: number): number => {
  //   if (granularity == "POWERSOF2") {
  //     if (max == 0) {
  //       min = 0;
  //       max = Math.pow(2, bucketCount);
  //     } else {
  //       min = max;
  //       max = max * 2;
  //     }
  //   }
  //   if (granularity == "1-2-5") {
  //   }
  //   if (granularity[0] == "R") {
  //   }
  //   if (granularity[0] == "E") {
  //   }
  //   return 0;
  // };

  const result = new Array<AnyObject>();
  // we will loop over to avoid copying arrays around to get nil values at the bottom.
  const size = sorted.length;
  // counter for sorted collection. seek to skip over nils.
  let index = 0;

  const approxBucketSize = Math.max(1, Math.round(sorted.length / bucketCount));

  for (let i = 0; i < bucketCount && index < size; i++) {
    const currentBucket = new Array<Any>();

    for (let j = 0; j < approxBucketSize && index < size; j++) {
      currentBucket.push(sorted[index++][1]);
    }

    // add items with the same key into the same bucket.
    while (index < size && isEqual(sorted[index - 1][0], sorted[index][0])) {
      currentBucket.push(sorted[index++][1]);
    }

    const min = getKey(currentBucket[0], groupByExpr, null, options) ?? null;
    let max: Any;
    // The _id.max field specifies the upper bound for the bucket.
    // This bound is exclusive for all buckets except the final bucket in the series, where it is inclusive.
    if (index < size) {
      // the min of next bucket.
      max = sorted[index][0] as Any;
    } else {
      max = getKey(
        currentBucket[currentBucket.length - 1],
        groupByExpr,
        null,
        options
      );
    }

    assert(
      isNil(max) || isNil(min) || min <= max,
      `error: $bucketAuto boundary must be in order.`
    );

    const outFields = computeValue(
      currentBucket,
      outputExpr,
      null,
      options
    ) as AnyObject;

    // remove nil entries from arrays
    for (const [k, v] of Object.entries(outFields)) {
      if (isArray(v)) outFields[k] = v.filter(v => v !== undefined);
    }

    result.push({
      ...outFields,
      _id: { min, max }
    });
  }

  return Lazy(result);
};
