import { Iterator } from "./lazy";
import {
  Any,
  AnyObject,
  ArrayOrObject,
  Callback,
  HashFunction,
  Predicate,
  WindowOperatorInput
} from "./types";
import {
  assert,
  has,
  isArray,
  isFunction,
  isNil,
  isObject,
  isObjectLike,
  isOperator,
  isString,
  resolve
} from "./util";

/**
 * Resolves the given string to a Collection.
 * This is useful for operators that require a second collection to use such as $lookup and $out.
 * The collection is not cached and will be resolved each time it is used.
 */
export type CollectionResolver = (name: string) => AnyObject[];

/** Specification for collation options */
export interface CollationSpec {
  readonly locale: string;
  readonly caseLevel?: boolean;
  readonly caseFirst?: "upper" | "lower" | "off";
  readonly strength?: 1 | 2 | 3;
  readonly numericOrdering?: boolean;
  readonly alternate?: string;
  readonly maxVariable?: never; // unsupported
  readonly backwards?: never; // unsupported
}

/**
 * JSON schema validator
 */
export type JsonSchemaValidator = (schema: AnyObject) => Predicate<AnyObject>;

/**
 * This controls how input and output documents are processed to meet different application needs.
 * Each mode has different trade offs for; immutability, reference sharing, and performance.
 */
export enum ProcessingMode {
  /**
   * Clone inputs prior to processing, and the outputs if some objects graphs may be shared.
   * Use this option to keep input collection immutable and to get distinct output objects.
   *
   * Note: This option is expensive and reduces performance.
   */
  CLONE_ALL = "CLONE_ALL",

  /**
   * Clones inputs prior to processing.
   * This option will return output objects with shared graphs in their path if specific operators are used.
   * Use this option to keep the input collection immutable.
   *
   */
  CLONE_INPUT = "CLONE_INPUT",

  /**
   * Clones the output to return distinct objects with no shared paths.
   * This option modifies the input collection and during processing.
   */
  CLONE_OUTPUT = "CLONE_OUTPUT",

  /**
   * Turn off cloning and modifies the input collection as needed.
   * This option will also return output objects with shared paths in their graph when specific operators are used.
   * This option provides the greatest speedup for the biggest tradeoff.
   * When using the aggregation pipeline, you can use the "$out" operator to collect immutable intermediate results.
   *
   * @default
   */
  CLONE_OFF = "CLONE_OFF"
}

/**
 * Generic options interface passed down to all operators
 */
export interface Options {
  /** The key that is used to lookup the ID value of a document. @default "_id". */
  readonly idKey: string;
  /** The collation specification for string sorting operations. */
  readonly collation?: CollationSpec;
  /** Determines how to treat inputs and outputs. @default ProcessingMode.CLONE_OFF. */
  readonly processingMode: ProcessingMode;
  /** Enforces strict MongoDB compatibilty. See README. @default true. */
  readonly useStrictMode: boolean;
  /** Enable or disable custom script execution via $where, $accumulator, and $function operators. @default true. */
  readonly scriptEnabled: boolean;
  /** Enable or disable falling back to the global context for operators. @default true. */
  readonly useGlobalContext: boolean;
  /** Hash function to replace the Effective Java default implementation. */
  readonly hashFunction?: HashFunction;
  /** Function to resolve strings to arrays for use with operators that reference other collections such as; `$lookup`, `$out` and `$merge`. */
  readonly collectionResolver?: CollectionResolver;
  /** JSON schema validator to use with the '$jsonSchema' operator. Required in order to use the operator. */
  readonly jsonSchemaValidator?: JsonSchemaValidator;
  /** Global variables. */
  readonly variables?: Readonly<AnyObject>;
  /** Extra references to operators to be used for processing. */
  readonly context: Context;
}

interface LocalData {
  /** The groupId computed for a group of documents. */
  readonly groupId?: Any;
  /** Local user-defind variables. */
  readonly variables?: AnyObject;
}

/** Custom type to facilitate type checking for global options */
export class ComputeOptions implements Options {
  #options: Options;
  /** Reference to the root object when processing subgraphs of the object. */
  #root: Any;
  #local: LocalData;

  private constructor(options: Options, root: Any, local?: LocalData) {
    this.#options = options;
    this.update(root, local);
  }

  /**
   * Initialize new ComputeOptions.
   *
   * @param options
   * @param root
   * @param local
   * @returns {ComputeOptions}
   */
  static init(options: Options, root?: Any, local?: LocalData): ComputeOptions {
    return options instanceof ComputeOptions
      ? new ComputeOptions(options.#options, options.root ?? root, {
          ...options.#local,
          ...local,
          // retain existing variables
          variables: Object.assign(
            {},
            options.#local?.variables,
            local?.variables
          )
        })
      : new ComputeOptions(options, root, local);
  }

  /** Updates the internal mutable state. */
  update(root?: Any, local?: LocalData): ComputeOptions {
    // NOTE: this is done for efficiency to avoid creating too many intermediate options objects.
    this.#root = root;
    // retain existing variables
    const variables = Object.assign(
      {},
      this.#local?.variables,
      local?.variables
    );
    if (Object.keys(variables).length) {
      this.#local = { ...local, variables };
    } else {
      this.#local = local ?? {};
    }

    return this;
  }

  getOptions() {
    return Object.freeze({
      ...this.#options,
      context: Context.from(this.#options.context)
    }) as Options;
  }

  get root() {
    return this.#root;
  }
  get local() {
    return this.#local;
  }
  get idKey() {
    return this.#options.idKey;
  }
  get collation() {
    return this.#options?.collation;
  }
  get processingMode() {
    return this.#options?.processingMode || ProcessingMode.CLONE_OFF;
  }
  get useStrictMode() {
    return this.#options?.useStrictMode;
  }
  get scriptEnabled() {
    return this.#options?.scriptEnabled;
  }
  get useGlobalContext() {
    return this.#options?.useGlobalContext;
  }
  get hashFunction() {
    return this.#options?.hashFunction;
  }
  get collectionResolver() {
    return this.#options?.collectionResolver;
  }
  get jsonSchemaValidator() {
    return this.#options?.jsonSchemaValidator;
  }
  get variables() {
    return this.#options?.variables;
  }
  get context() {
    return this.#options?.context;
  }
}

/**
 * Creates an Option from another where required keys are initialized.
 * @param options Options
 */
export function initOptions(options: Partial<Options>): Options {
  return options instanceof ComputeOptions
    ? options.getOptions()
    : Object.freeze({
        idKey: "_id",
        scriptEnabled: true,
        useStrictMode: true,
        useGlobalContext: true,
        processingMode: ProcessingMode.CLONE_OFF,
        ...options,
        context: options?.context
          ? Context.from(options?.context)
          : Context.init({})
      });
}

/**
 * Supported cloning modes.
 * - "deep": Performs a recursive deep clone of the object.
 * - "copy": Performs a shallow copy of the object.
 * - "none": No cloning. Uses the value as given.
 */
export type CloneMode = "deep" | "copy" | "none";

export interface UpdateOptions {
  /** Specifies whether to deep clone values to persist in the internal store. @default "copy". */
  readonly cloneMode?: CloneMode;
  /** Options to use for processing queries. Unless overriden 'useStrictMode' is false.  */
  readonly queryOptions?: Partial<Options>;
}

/**
 * The different groups of operators
 */
export enum OperatorType {
  ACCUMULATOR = "accumulator",
  EXPRESSION = "expression",
  PIPELINE = "pipeline",
  PROJECTION = "projection",
  QUERY = "query",
  WINDOW = "window"
}

export type AccumulatorOperator<R = Any> = (
  collection: Any[],
  expr: Any,
  options: Options
) => R;

export type ExpressionOperator<R = Any> = (
  obj: AnyObject,
  expr: Any,
  options: Options
) => R;

export type PipelineOperator = (
  collection: Iterator,
  expr: Any,
  options: Options
) => Iterator;

export type ProjectionOperator = (
  obj: AnyObject,
  expr: Any,
  selector: string,
  options: Options
) => Any;

export type QueryOperator = (
  selector: string,
  value: Any,
  options: Options
) => (obj: AnyObject) => boolean;

export type WindowOperator = (
  obj: AnyObject,
  array: AnyObject[],
  expr: WindowOperatorInput,
  options: Options
) => Any;

/** Interface for update operators */
export type UpdateOperator = (
  obj: AnyObject,
  expr: AnyObject,
  arrayFilters: AnyObject[],
  options: UpdateOptions
) => string[];

export type Operator =
  | AccumulatorOperator
  | ExpressionOperator
  | PipelineOperator
  | ProjectionOperator
  | QueryOperator
  | WindowOperator;

/** Map of operator functions */
export type OperatorMap = Record<string, Operator>;

type ContextMap = Partial<{
  [OperatorType.ACCUMULATOR]: Record<string, AccumulatorOperator>;
  [OperatorType.EXPRESSION]: Record<string, ExpressionOperator>;
  [OperatorType.PIPELINE]: Record<string, PipelineOperator>;
  [OperatorType.PROJECTION]: Record<string, ProjectionOperator>;
  [OperatorType.QUERY]: Record<string, QueryOperator>;
  [OperatorType.WINDOW]: Record<string, WindowOperator>;
}>;

type AccumulatorOps = Record<string, AccumulatorOperator>;
type ExpressionOps = Record<string, ExpressionOperator>;
type ProjectionOps = Record<string, ProjectionOperator>;
type QueryOps = Record<string, QueryOperator>;
type PipelineOps = Record<string, PipelineOperator>;
type WindowOps = Record<string, WindowOperator>;

export class Context {
  private readonly operators: ContextMap = {
    [OperatorType.ACCUMULATOR]: {},
    [OperatorType.EXPRESSION]: {},
    [OperatorType.PIPELINE]: {},
    [OperatorType.PROJECTION]: {},
    [OperatorType.QUERY]: {},
    [OperatorType.WINDOW]: {}
  };

  private constructor(ops: ContextMap) {
    for (const [type, operators] of Object.entries(ops)) {
      this.addOperators(type as OperatorType, operators as OperatorMap);
    }
  }

  static init(ops: ContextMap = {}): Context {
    return new Context(ops);
  }

  static from(ctx: Context): Context {
    return new Context(ctx.operators);
  }

  private addOperators(type: OperatorType, ops: OperatorMap): Context {
    for (const [name, fn] of Object.entries(ops)) {
      if (!this.getOperator(type, name)) {
        (this.operators[type] as OperatorMap)[name] = fn;
      }
    }
    return this;
  }

  // register

  addAccumulatorOps(ops: AccumulatorOps) {
    return this.addOperators(OperatorType.ACCUMULATOR, ops);
  }

  addExpressionOps(ops: ExpressionOps) {
    return this.addOperators(OperatorType.EXPRESSION, ops);
  }

  addQueryOps(ops: QueryOps) {
    return this.addOperators(OperatorType.QUERY, ops);
  }

  addPipelineOps(ops: PipelineOps) {
    return this.addOperators(OperatorType.PIPELINE, ops);
  }

  addProjectionOps(ops: ProjectionOps) {
    return this.addOperators(OperatorType.PROJECTION, ops);
  }

  addWindowOps(ops: WindowOps) {
    return this.addOperators(OperatorType.WINDOW, ops);
  }

  // getters
  getOperator(type: OperatorType, name: string): Callback | null {
    return type in this.operators ? this.operators[type][name] || null : null;
  }
}

// global context
const GLOBAL_CONTEXT = Context.init();

/**
 * Register fully specified operators for the given operator class.
 *
 * @param type The operator type
 * @param operators Map of the operators
 */
export function useOperators(type: OperatorType, operators: OperatorMap): void {
  for (const [name, fn] of Object.entries(operators)) {
    assert(
      isFunction(fn) && isOperator(name),
      `'${name}' is not a valid operator`
    );
    const currentFn = getOperator(type, name, null);
    assert(
      !currentFn || fn === currentFn,
      `${name} already exists for '${type}' operators. Cannot change operator function once registered.`
    );
  }
  // toss the operator salad :)
  switch (type) {
    case OperatorType.ACCUMULATOR:
      GLOBAL_CONTEXT.addAccumulatorOps(operators as AccumulatorOps);
      break;
    case OperatorType.EXPRESSION:
      GLOBAL_CONTEXT.addExpressionOps(operators as ExpressionOps);
      break;
    case OperatorType.PIPELINE:
      GLOBAL_CONTEXT.addPipelineOps(operators as PipelineOps);
      break;
    case OperatorType.PROJECTION:
      GLOBAL_CONTEXT.addProjectionOps(operators as ProjectionOps);
      break;
    case OperatorType.QUERY:
      GLOBAL_CONTEXT.addQueryOps(operators as QueryOps);
      break;
    case OperatorType.WINDOW:
      GLOBAL_CONTEXT.addWindowOps(operators as WindowOps);
      break;
  }
}

/**
 * Overrides the current global context with this new one.
 *
 * @param context The new context to override the global one with.
 */
// export const setGlobalContext = (context: Context): void => {
//   GLOBAL_CONTEXT = context;
// };

/**
 * Returns the operator function or undefined if it is not found
 * @param type Type of operator
 * @param operator Name of the operator
 */
export function getOperator(
  type: OperatorType,
  operator: string,
  options: Pick<Options, "useGlobalContext" | "context">
): Operator {
  const { context: ctx, useGlobalContext: fallback } = options || {};
  const fn = ctx ? (ctx.getOperator(type, operator) as Operator) : null;
  return !fn && fallback ? GLOBAL_CONTEXT.getOperator(type, operator) : fn;
}

/* eslint-disable unused-imports/no-unused-vars-ts */

/**
 * Implementation of system variables
 * @type {Object}
 */
const systemVariables: Record<string, typeof redact> = {
  $$ROOT(_obj: Any, _expr: Any, options: ComputeOptions) {
    return options.root;
  },
  $$CURRENT(obj: Any, _expr: Any, _options: ComputeOptions) {
    return obj;
  },
  $$REMOVE(_obj: Any, _expr: Any, _options: ComputeOptions) {
    return undefined;
  },
  $$NOW(_obj: Any, _expr: Any, options: ComputeOptions) {
    return new Date();
  }
};

/**
 * Implementation of $redact variables
 *
 * Each function accepts 3 arguments (obj, expr, options)
 *
 * @type {Object}
 */
const redactVariables: Record<string, typeof redact> = {
  $$KEEP(obj: Any, _expr: Any, _options: ComputeOptions): Any {
    return obj;
  },
  $$PRUNE(_obj: Any, _expr: Any, _options: ComputeOptions): Any {
    return undefined;
  },
  $$DESCEND(obj: AnyObject, expr: Any, options: ComputeOptions): Any {
    // traverse nested documents iff there is a $cond
    if (!has(expr as AnyObject, "$cond")) return obj;

    let result: ArrayOrObject;

    for (const [key, current] of Object.entries(obj)) {
      if (isObjectLike(current)) {
        if (isArray(current)) {
          const array: Any[] = [];
          for (let elem of current) {
            if (isObject(elem)) {
              elem = redact(elem as AnyObject, expr, options.update(elem));
            }
            if (!isNil(elem)) {
              array.push(elem);
            }
          }
          result = array;
        } else {
          result = redact(
            current as AnyObject,
            expr,
            options.update(current)
          ) as ArrayOrObject;
        }

        if (isNil(result)) {
          delete obj[key]; // pruned result
        } else {
          obj[key] = result;
        }
      }
    }
    return obj;
  }
};
/* eslint-enable unused-imports/no-unused-vars-ts */

const AGGREGATION_OPS = [
  OperatorType.EXPRESSION,
  OperatorType.ACCUMULATOR
] as const;

/**
 * Computes the value of the expression on the object for the given operator
 *
 * @param obj the current object from the collection
 * @param expr the expression for the given field
 * @param operator the operator to resolve the field with
 * @param options {Object} extra options
 * @returns {*}
 */
export function computeValue(
  obj: Any,
  expr: Any,
  operator: string | null,
  options?: Options
): Any {
  // ensure valid options exist on first invocation
  const copts = ComputeOptions.init(options, obj);
  operator = operator || "";

  if (isOperator(operator)) {
    // if the field of the object is a valid operator
    const callExpression = getOperator(
      OperatorType.EXPRESSION,
      operator,
      options
    ) as ExpressionOperator;

    if (callExpression) return callExpression(obj as AnyObject, expr, copts);

    // we also handle $group accumulator operators
    const callAccumulator = getOperator(
      OperatorType.ACCUMULATOR,
      operator,
      options
    ) as AccumulatorOperator;

    // operator was not found
    assert(!!callAccumulator, `Operator '${operator}' is not registered.`);

    // if object is not an array, first try to compute using the expression
    if (!isArray(obj)) {
      obj = computeValue(obj, expr, null, copts);
      expr = null;
    }

    assert(
      isArray(obj),
      `The expression for operator '${operator}' must resolve to an array.`
    );

    // for accumulators, we use the global options since the root is specific to each element within array.
    return callAccumulator(
      obj as Any[],
      expr,
      copts.update(null, copts.local) // reset the root object.
    );
  }

  // if expr is a string and begins with "$$", then we have a variable.
  //  this can be one of; redact variable, system variable, user-defined variable.
  //  we check and process them in that order.
  //
  // if expr begins only a single "$", then it is a path to a field on the object.
  if (isString(expr) && expr.length > 0 && expr[0] === "$") {
    // we return redact variables as literals
    if (has(redactVariables, expr)) return expr;

    // default to root for resolving path.
    let ctx = copts.root;

    // handle selectors with explicit prefix
    const arr = expr.split(".");
    if (has(systemVariables, arr[0])) {
      // set 'root' only the first time it is required to be used for all subsequent calls
      // if it already available on the options, it will be used
      ctx = systemVariables[arr[0]](
        obj as AnyObject,
        null,
        copts
      ) as ArrayOrObject;
      expr = expr.slice(arr[0].length + 1); //  +1 for '.'
    } else if (arr[0].slice(0, 2) === "$$") {
      // handle user-defined variables
      ctx = Object.assign(
        {},
        copts.variables, // global vars
        // current item is added before local variables because the binding may be changed.
        { this: obj },
        copts.local?.variables // local vars
      );
      // the variable name
      const name = arr[0].slice(2);

      assert(has(ctx as AnyObject, name), `Use of undefined variable: ${name}`);
      expr = expr.slice(2);
    } else {
      // 'expr' is a path to a field on the object.
      expr = expr.slice(1);
    }

    return expr === "" ? ctx : resolve(ctx as ArrayOrObject, expr as string);
  }

  // check and return value if already in a resolved state
  if (isArray(expr)) {
    return expr.map((item: Any) => computeValue(obj, item, null, copts));
  }

  if (isObject(expr)) {
    const result: AnyObject = {};
    for (const [key, val] of Object.entries(expr as AnyObject)) {
      result[key] = computeValue(obj, val, key, copts);
      // must run ONLY one aggregate operator per expression
      // if so, return result of the computed value
      if (AGGREGATION_OPS.some(t => !!getOperator(t, key, options))) {
        // there should be only one operator
        assert(
          Object.keys(expr).length === 1,
          "Invalid aggregation expression '" + JSON.stringify(expr) + "'"
        );

        return result[key];
      }
    }
    return result;
  }

  return expr;
}

/**
 * Redact an object
 * @param  {Object} obj The object to redact
 * @param  {*} expr The redact expression
 * @param  {*} options  Options for value
 * @return {*} returns the result of the redacted object
 */
export function redact(
  obj: AnyObject,
  expr: Any,
  options: ComputeOptions
): Any {
  const result = computeValue(obj, expr, null, options) as string;
  return has(redactVariables, result)
    ? redactVariables[result](obj, expr, options)
    : result;
}
