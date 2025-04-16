// Query Array Operators: https://docs.mongodb.com/manual/reference/operator/query-array/

import { Options, QueryOperator } from "../../../core";
import { Any } from "../../../types";
import { $elemMatch as __elemMatch, processQuery } from "../../_predicates";

/**
 * Selects documents if element in the array field matches all the specified $elemMatch conditions.
 */
export const $elemMatch: QueryOperator = (
  selector: string,
  value: Any,
  options: Options
) => processQuery(selector, value, options, __elemMatch);
