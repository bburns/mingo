import { UpdateOptions } from "../../core";
import { AnyObject, ArrayOrObject } from "../../types";
import { Action, applyUpdate, walkExpression } from "./_internal";

/** Sets the value of a field to the current date. */
export const $currentDate = (
  obj: AnyObject,
  expr: Record<string, true>,
  arrayFilters: AnyObject[] = [],
  options: UpdateOptions = {}
) => {
  const now = Date.now();
  return walkExpression(expr, arrayFilters, options, ((_, node, queries) => {
    return applyUpdate(
      obj,
      node,
      queries,
      (o: ArrayOrObject, k: string | number) => {
        o[k] = now;
        return true;
      },
      { buildGraph: true }
    );
  }) as Action);
};
