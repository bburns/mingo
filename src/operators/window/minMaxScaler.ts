import { Options } from "../../core";
import { Any, AnyObject } from "../../types";
import { assert, isArray, isNumber } from "../../util";
import { $push } from "../accumulator/push";
import { WindowOperatorInput, withMemo } from "./_internal";

/**
 * Normalizes a numeric expression within a window of values. By default, values can range between zero and one.
 * The smallest value becomes zero, the largest value becomes one, and all other values scale proportionally in between zero and one.
 * You can also specify a custom minimum and maximum value for the normalized output range.
 *
 * See {@link https://docs.mongodb.com/manual/reference/operator/aggregation/minMaxScaler/}
 */
export const $minMaxScaler = (
  _: AnyObject,
  collection: AnyObject[],
  expr: WindowOperatorInput,
  options: Options
): Any => {
  return withMemo(
    collection,
    expr,
    () => {
      const args = expr.inputExpr as {
        input: Any;
        min?: number;
        max?: number;
      };
      const min = args.min || 0;
      const max = args.max || 1;
      // compute numeric values in range using the available expression syntax option.
      const nums = $push(
        collection,
        args.input || expr.inputExpr,
        options
      ) as number[];
      assert(
        isArray(nums) && nums.length > 0 && nums.every(isNumber),
        "$minMaxScaler: input must be a numeric array"
      );
      // initialize min/max to first number if available.
      let rmin = nums[0];
      let rmax = nums[0];
      for (const n of nums) {
        if (n < rmin) rmin = n;
        else if (n > rmax) rmax = n;
      }
      const scale = max - min;
      const range = rmax - rmin;
      assert(range !== 0, "$minMaxScaler: input range must not be zero");
      return {
        min,
        scale,
        rmin,
        range,
        nums
      };
    },
    (data: {
      min: number;
      rmin: number;
      scale: number;
      range: number;
      nums: number[];
    }) => {
      const { min, rmin, scale, range, nums } = data;
      // function: ((x - min(X)) / (max(X) - min(X))) * (max - min) + min
      return ((nums[expr.documentNumber - 1] - rmin) / range) * scale + min;
    }
  );
};
