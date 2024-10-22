import { Options } from "../../core";
import { Any, AnyObject, WindowOperatorInput } from "../../types";
import { rank } from "./_internal";

/** Returns the position of a document in the $setWindowFields stage partition. */
export function $rank(
  obj: AnyObject,
  collection: AnyObject[],
  expr: WindowOperatorInput,
  options: Options
): Any {
  return rank(obj, collection, expr, options, false /*dense*/);
}
