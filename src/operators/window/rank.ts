import { Options } from "../../core";
import { Any, AnyObject } from "../../types";
import { rank, WindowOperatorInput } from "./_internal";

/** Returns the position of a document in the $setWindowFields stage partition. */
export const $rank = (
  obj: AnyObject,
  collection: AnyObject[],
  expr: WindowOperatorInput,
  options: Options
): Any => rank(obj, collection, expr, options, false /*dense*/);
