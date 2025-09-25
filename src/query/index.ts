import { initOptions, Options } from "../core";
import * as booleanOperators from "../operators/expression/boolean";
import * as comparisonOperators from "../operators/expression/comparison";
import * as projectionOperators from "../operators/projection";
import * as queryOperators from "../operators/query";
import { AnyObject } from "../types";
import { QueryImpl } from "./_internal";

/**
 * Represents a query object used to filter and match documents based on specified criteria.
 *
 * The `Query` class provides methods to compile query conditions, test objects against
 * the query criteria, and retrieve matching documents from a collection.
 *
 * @example
 * ```typescript
 * const query = new Query({ age: { $gt: 18 } });
 * const result = query.test({ name: "John", age: 25 }); // true
 * ```
 */
export class Query extends QueryImpl {
  /**
   * Creates an instance of the query with the specified condition and options.
   *
   * @param condition - The query condition object used to define the criteria for matching documents.
   * @param options - Optional configuration settings to customize the query behavior.
   */
  constructor(condition: AnyObject, options?: Partial<Options>) {
    const opts = initOptions(options);
    opts.context
      .addExpressionOps(booleanOperators)
      .addExpressionOps(comparisonOperators)
      .addProjectionOps(projectionOperators)
      .addQueryOps(queryOperators);
    super(condition, opts);
  }
}
