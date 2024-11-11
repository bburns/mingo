import { Aggregator } from "../../aggregator";
import {
  ComputeOptions,
  computeValue,
  Options,
  PipelineOperator
} from "../../core";
import { Iterator } from "../../lazy";
import { AnyObject } from "../../types";
import {
  assert,
  hashCode,
  isArray,
  isString,
  MingoError,
  resolve
} from "../../util";
import { $mergeObjects } from "../expression";

interface InputExpr {
  readonly into: string | AnyObject[];
  readonly on?: string | [string];
  readonly let?: AnyObject;
  readonly whenMatched?:
    | "replace"
    | "keepExisting"
    | "merge"
    | "fail"
    | AnyObject[];
  readonly whenNotMatched?: "insert" | "discard" | "fail";
}

/**
 * Writes the resulting documents of the aggregation pipeline to a collection.
 *
 * NB: Object are deep cloned for outputing regardless of the ProcessingMode.
 *
 * See {@link https://www.mongodb.com/docs/manual/reference/operator/aggregation/merge/ usage}.
 *
 * @param collection
 * @param expr
 * @param options
 * @returns
 */
export const $merge: PipelineOperator = (
  collection: Iterator,
  expr: InputExpr,
  options: Options
): Iterator => {
  const output: AnyObject[] = isString(expr.into)
    ? options?.collectionResolver(expr.into)
    : expr.into;

  assert(isArray(output), `$merge: option 'into' must resolve to an array`);

  const onField = expr.on || options.idKey;

  const getHash = (o: AnyObject) => {
    const val = isString(onField)
      ? resolve(o, onField)
      : onField.map(s => resolve(o, s));
    return hashCode(val, options.hashFunction);
  };

  const hash: Record<string, [AnyObject, number]> = {};

  // we assuming the lookup expressions are unique
  for (let i = 0; i < output.length; i++) {
    const obj = output[i];
    const k = getHash(obj);
    assert(
      !hash[k],
      "$merge: 'into' collection must have unique entries for the 'on' field."
    );
    hash[k] = [obj, i];
  }

  const copts = ComputeOptions.init(options);

  return collection.map((o: AnyObject) => {
    const k = getHash(o);
    if (hash[k]) {
      const [target, i] = hash[k];

      // compute variables
      const variables = computeValue(
        target,
        expr.let || { new: "$$ROOT" },
        null,
        // 'root' is the item from the iteration.
        copts.update(o)
      ) as AnyObject;

      if (isArray(expr.whenMatched)) {
        const aggregator = new Aggregator(expr.whenMatched, {
          ...options,
          variables
        });
        output[i] = aggregator.run([target])[0];
      } else {
        switch (expr.whenMatched) {
          case "replace":
            output[i] = o;
            break;
          case "fail":
            throw new MingoError(
              "$merge: failed due to matching as specified by 'whenMatched' option."
            );
          case "keepExisting":
            break;
          case "merge":
          default:
            output[i] = $mergeObjects(
              target,
              [target, o],
              // 'root' is the item from the iteration.
              copts.update(o, { variables })
            );
            break;
        }
      }
    } else {
      switch (expr.whenNotMatched) {
        case "discard":
          break;
        case "fail":
          throw new MingoError(
            "$merge: failed due to matching as specified by 'whenMatched' option."
          );
        case "insert":
        default:
          output.push(o);
          break;
      }
    }

    return o; // passthrough
  });
};
