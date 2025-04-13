import {
  getOperator,
  initOptions,
  Options,
  OpType,
  QueryOperator
} from "./core";
import { Cursor } from "./cursor";
import { Source } from "./lazy";
import { Any, AnyObject, Predicate } from "./types";
import { assert, cloneDeep, isObject, isOperator, normalize } from "./util";

const TOP_LEVEL_OPS = new Set(
  Array.from(["$and", "$or", "$nor", "$expr", "$jsonSchema"])
);

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
 *
 * @template T - The type of objects being queried.
 */
export class Query {
  #compiled: Predicate<Any>[];
  #options: Options;
  #condition: AnyObject;

  /**
   * Creates an instance of the query with the specified condition and options.
   *
   * @param condition - The query condition object used to define the criteria for matching documents.
   * @param options - Optional configuration settings to customize the query behavior.
   */
  constructor(condition: AnyObject, options?: Partial<Options>) {
    this.#condition = cloneDeep(condition);
    this.#options = initOptions(options);
    this.#compiled = [];
    this.compile();
  }

  private compile(): void {
    assert(
      isObject(this.#condition),
      `query criteria must be an object: ${JSON.stringify(this.#condition)}`
    );

    const whereOperator: { field?: string; expr?: Any } = {};

    for (const [field, expr] of Object.entries(this.#condition)) {
      if ("$where" === field) {
        assert(
          this.#options.scriptEnabled,
          "$where operator requires 'scriptEnabled' option to be true."
        );
        Object.assign(whereOperator, { field: field, expr: expr });
      } else if (TOP_LEVEL_OPS.has(field)) {
        this.processOperator(field, field, expr);
      } else {
        // normalize expression
        assert(!isOperator(field), `unknown top level operator: ${field}`);
        for (const [operator, val] of Object.entries(
          normalize(expr) as AnyObject
        )) {
          this.processOperator(field, operator, val);
        }
      }

      if (whereOperator.field) {
        this.processOperator(
          whereOperator.field,
          whereOperator.field,
          whereOperator.expr
        );
      }
    }
  }

  private processOperator(field: string, operator: string, value: Any): void {
    const call = getOperator(
      OpType.QUERY,
      operator,
      this.#options
    ) as QueryOperator;
    assert(!!call, `unknown query operator ${operator}`);
    this.#compiled.push(call(field, value, this.#options));
  }

  /**
   * Tests whether the given object satisfies all compiled predicates.
   *
   * @template T - The type of the object to test.
   * @param obj - The object to be tested against the compiled predicates.
   * @returns `true` if the object satisfies all predicates, otherwise `false`.
   */
  test<T>(obj: T): boolean {
    return this.#compiled.every(p => p(obj));
  }

  /**
   * Returns a cursor for iterating over the items in the given collection that match the query criteria.
   *
   * @typeParam T - The type of the items in the resulting cursor.
   * @param collection - The source collection to search through.
   * @param projection - An optional object specifying fields to include or exclude
   *                      in the returned items.
   * @returns A `Cursor` instance for iterating over the matching items.
   */
  find<T>(collection: Source, projection?: AnyObject): Cursor<T> {
    return new Cursor<T>(
      collection,
      o => this.test(o),
      projection || {},
      this.#options
    );
  }
}
