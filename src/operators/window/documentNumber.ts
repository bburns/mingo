import { Options } from "../../core";
import { Any, AnyObject } from "../../types";
import { WindowOperatorInput } from "./_internal";

/** Returns the position of a document in the $setWindowFields stage partition. */
export const $documentNumber = (
  _obj: AnyObject,
  _collection: AnyObject[],
  expr: WindowOperatorInput,
  _options: Options
): Any => expr.documentNumber;
