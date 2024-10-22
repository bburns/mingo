import { Options } from "../../core";
import { Any, AnyObject, WindowOperatorInput } from "../../types";
import { rank } from "./_internal";

/** Returns the document position relative to other documents in the $setWindowFields stage partition. */
export function $denseRank(
  obj: AnyObject,
  collection: AnyObject[],
  expr: WindowOperatorInput,
  options: Options
): Any {
  return rank(obj, collection, expr, options, true /*dense*/);
}
