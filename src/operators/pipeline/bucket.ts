import { computeValue, Options, PipelineOperator } from "../../core";
import { Iterator, Lazy } from "../../lazy";
import { Any, AnyObject, Callback } from "../../types";
import {
  assert,
  compare,
  findInsertIndex,
  into,
  isNil,
  typeOf
} from "../../util";

/**
 * Categorizes incoming documents into groups, called buckets, based on a specified expression and bucket boundaries.
 * https://docs.mongodb.com/manual/reference/operator/aggregation/bucket/
 *
 * @param {*} collection
 * @param {*} expr
 * @param {Options} opt Pipeline options
 */
export const $bucket: PipelineOperator = (
  collection: Iterator,
  expr: {
    groupBy: Any;
    boundaries: Any[];
    default: Any;
    output?: AnyObject;
  },
  options: Options
): Iterator => {
  const boundaries = [...expr.boundaries];
  const defaultKey = expr.default as string;
  const lower = boundaries[0]; // inclusive
  const upper = boundaries[boundaries.length - 1]; // exclusive
  const outputExpr = expr.output || { count: { $sum: 1 } };

  assert(
    expr.boundaries.length > 2,
    "$bucket 'boundaries' expression must have at least 3 elements"
  );
  const boundType = typeOf(lower);

  for (let i = 0, len = boundaries.length - 1; i < len; i++) {
    assert(
      boundType === typeOf(boundaries[i + 1]),
      "$bucket 'boundaries' must all be of the same type"
    );
    assert(
      compare(boundaries[i], boundaries[i + 1]) < 0,
      "$bucket 'boundaries' must be sorted in ascending order"
    );
  }

  !isNil(defaultKey) &&
    typeOf(expr.default) === typeOf(lower) &&
    assert(
      compare(expr.default, upper) >= 0 || compare(expr.default, lower) < 0,
      "$bucket 'default' expression must be out of boundaries range"
    );

  const grouped: Record<string, Any[]> = {};
  for (const k of boundaries) {
    grouped[k as string] = [];
  }

  // add default key if provided
  if (!isNil(defaultKey)) grouped[defaultKey] = [];

  let iterator: Iterator | undefined;

  return Lazy(() => {
    if (!iterator) {
      collection.each(((obj: AnyObject) => {
        const key = computeValue(obj, expr.groupBy, null, options);

        if (isNil(key) || compare(key, lower) < 0 || compare(key, upper) >= 0) {
          assert(
            !isNil(defaultKey),
            "$bucket require a default for out of range values"
          );
          grouped[defaultKey].push(obj);
        } else {
          assert(
            compare(key, lower) >= 0 && compare(key, upper) < 0,
            "$bucket 'groupBy' expression must resolve to a value in range of boundaries"
          );
          const index = findInsertIndex(boundaries, key);
          const boundKey = boundaries[Math.max(0, index - 1)] as string;
          grouped[boundKey].push(obj);
        }
      }) as Callback);

      // upper bound is exclusive so we remove it
      boundaries.pop();
      if (!isNil(defaultKey)) boundaries.push(defaultKey);

      iterator = Lazy(boundaries).map(((key: string) => {
        const acc = computeValue(
          grouped[key],
          outputExpr,
          null,
          options
        ) as AnyObject[];
        return into(acc, { _id: key });
      }) as Callback<Any[]>);
    }

    return iterator.next();
  });
};
