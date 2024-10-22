import { UpdateOptions } from "../../core";
import { Any, AnyObject } from "../../types";
import { $pull } from "./pull";

/** Removes all instances of the specified values from an existing array. */
export const $pullAll = (
  obj: AnyObject,
  expr: Record<string, Any[]>,
  arrayFilters: AnyObject[] = [],
  options: UpdateOptions = {}
) => {
  const pullExpr: Record<string, AnyObject> = {};
  Object.entries(expr).forEach(([k, v]) => {
    pullExpr[k] = { $in: v };
  });
  return $pull(obj, pullExpr, arrayFilters, options);
};
