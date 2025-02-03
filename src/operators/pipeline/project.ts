import {
  ComputeOptions,
  computeValue,
  getOperator,
  Options,
  PipelineOperator,
  ProjectionOperator,
  QueryOperator,
  QueryOptions
} from "../../core";
import { Iterator } from "../../lazy";
import { Any, AnyObject, Callback } from "../../types";
import {
  assert,
  ensureArray,
  filterMissing,
  has,
  isArray,
  isBoolean,
  isEmpty,
  isNumber,
  isObject,
  isOperator,
  isString,
  merge,
  normalize,
  removeValue,
  resolve,
  resolveGraph,
  setValue
} from "../../util";

/**
 * Reshapes each document in the stream, such as by adding new fields or removing existing fields.
 * For each input document, outputs one document.
 *
 * See {@link https://www.mongodb.com/docs/manual/reference/operator/aggregation/project usage}.
 *
 * @param collection
 * @param expr
 * @param opt
 * @returns
 */
export const $project: PipelineOperator = (
  collection: Iterator,
  expr: AnyObject,
  options: Options
): Iterator => {
  if (isEmpty(expr)) return collection;
  checkExpression(expr, options);
  return collection.map(createHandler(expr, options));
};

/**
 * Validate inclusion and exclusion values in expression
 *
 * @param {Object} expr The expression given for the projection
 */
function checkExpression(expr: AnyObject, options: Options): void {
  let exclusions = false;
  let inclusions = false;
  let positional = 0;
  for (const [k, v] of Object.entries(expr)) {
    assert(!k.startsWith("$"), "Field names may not start with '$'.");
    if (k.endsWith(".$")) {
      assert(
        ++positional < 2,
        "Cannot specify more than one positional projection per query."
      );
    }
    if (k === options?.idKey) continue;
    if (v === 0 || v === false) {
      exclusions = true;
    } else if (v === 1 || v === true) {
      inclusions = true;
    }
    assert(
      !(exclusions && inclusions),
      "Projection cannot have a mix of inclusion and exclusion."
    );
  }
}

/**
 * Returns a callback that selects the first matching value for a positional query operator.
 * @param field The positional field from the projection expression excluding ".$" suffix.
 * @param cond The query condition expression in which to check for the 'field'.
 * @param options Options to the projection.
 * @returns
 */
function getPositionalFilter(
  field: string,
  cond: AnyObject,
  options: Options
): Callback<void> {
  // extract the queries for the field and siblings if part of an $and expression.
  let operator: string;
  let expr: Any;
  let selector: string;
  for (const key of Object.keys(cond)) {
    if (key === field || key.startsWith(field + ".")) {
      const entry = Object.entries(normalize(cond[key])).pop();
      operator = entry[0];
      expr = entry[1];
      selector = key;
    } else if (isOperator(key)) {
      for (const val of cond[key] as AnyObject[]) {
        try {
          return getPositionalFilter(field, val, options);
        } catch {
          /*try each key*/
        }
      }
    }
  }
  assert(!!operator && !!expr, `query must include array field '${field}'.`);
  const call = getOperator("query", operator, options) as QueryOperator;
  assert(!!call, `no query operator found for '${operator}'.`);

  // handle two cases of nested fields. e.g. "a.b.c" can be.
  //  1. {a:{b:[{c:1},{c:2}...]}}
  //  2. {a:{b:{c:[...]}}}
  // we split the selector into the (path, leaf) eg. "a.b.c" -> ["a.b", "c"].
  // then we use the 'leaf' as the selector to the compiled predicate for the case of nested objects in array paths.
  // since we always need to send an object to the predicate, for non-objects we wrap in an object with the 'leaf' as the key.
  const sep = selector.lastIndexOf(".");
  const path = selector.substring(0, sep) || selector;
  const leaf = selector.substring(sep + 1);
  const pred = call(leaf, expr, options);

  return (o: AnyObject) => {
    const pathVal = resolve(o, path);
    const arr = isArray(pathVal)
      ? pathVal
      : (resolve(pathVal as Any[], leaf) as AnyObject[]);
    const res = [];
    for (const elem of arr as AnyObject[]) {
      let item = elem;
      if (operator === "$elemMatch") {
        item = { [leaf]: [elem] };
      } else if (!isObject(item)) {
        item = { [leaf]: item };
      }
      if (pred(item)) {
        res.push(elem);
        break;
      }
    }
    setValue(o, path, res);
  };
}

type Handler = (_: AnyObject) => Any;

/**
 * Creates a precompiled handler for projection operation.
 * @param expr  The projection expression
 * @param options The options
 * @param isRoot Indicates whether the handler is for the root object.
 * @returns
 */
function createHandler(
  expr: AnyObject,
  options: Options,
  isRoot: boolean = true
): Handler {
  const idKey = options.idKey;
  const expressionKeys = Object.keys(expr);
  const excludedKeys = new Array<string>();
  const includedKeys = new Array<string>();
  const handlers: Record<string, Handler> = {};
  const positional: Record<string, Callback<void>> = {};
  const copts = ComputeOptions.init(options);

  for (const key of expressionKeys) {
    // get expression associated with key
    const subExpr = expr[key];

    if (isNumber(subExpr) || isBoolean(subExpr)) {
      // positive number or true
      if (subExpr) {
        // get predicate for field if used as a positional projection "<array>.$".
        if (isRoot && key.endsWith(".$")) {
          const field = key.substring(0, key.lastIndexOf(".$"));
          // locate the query condition on the options object.
          const condition =
            options instanceof QueryOptions ? options.condition : undefined;
          assert(
            !!condition,
            "query must be specified to support projection positional operator '$'."
          );
          positional[field] = getPositionalFilter(field, condition, options);
          includedKeys.push(field);
        } else {
          includedKeys.push(key);
        }
      } else {
        excludedKeys.push(key);
      }
    } else if (isArray(subExpr)) {
      handlers[key] = (o: AnyObject) =>
        subExpr.map(v => computeValue(o, v, null, copts.update(o)) ?? null);
    } else if (isObject(subExpr)) {
      const subExprKeys = Object.keys(subExpr);
      const operator = subExprKeys.length == 1 ? subExprKeys[0] : "";
      // first try projection operator as used in Query.find() queries
      const projectFn = getOperator(
        "projection",
        operator,
        options
      ) as ProjectionOperator;
      if (projectFn) {
        // check if this $slice operator is used with $expr instead of Query.find()
        // we assume $slice is used with $expr if any of its arguments are not a number
        const foundSlice = operator === "$slice";
        if (foundSlice && !ensureArray(subExpr[operator]).every(isNumber)) {
          handlers[key] = (o: AnyObject) =>
            computeValue(o, subExpr, key, copts.update(o));
        } else {
          handlers[key] = (o: AnyObject) =>
            projectFn(o, subExpr[operator], key, copts.update(o));
        }
      } else if (isOperator(operator)) {
        // pipelien projection
        handlers[key] = (o: AnyObject) =>
          computeValue(o, subExpr[operator], operator, copts);
      } else {
        // repeat for nested expression
        checkExpression(subExpr as AnyObject, copts);
        handlers[key] = (o: AnyObject) => {
          if (!has(o, key)) return computeValue(o, subExpr, null, copts);
          // ensure that the root object is passed down.
          if (isRoot) copts.update(o);
          const target = resolve(o, key);
          const fn = createHandler(subExpr as AnyObject, copts, false);
          if (isArray(target)) return target.map(fn);
          if (isObject(target)) return fn(target as AnyObject);
          return fn(o);
        };
      }
    } else {
      handlers[key] =
        isString(subExpr) && subExpr[0] === "$"
          ? (o: AnyObject) => computeValue(o, subExpr, key, copts)
          : (_: AnyObject) => subExpr;
    }
  }

  const handlerKeys = Object.keys(handlers);
  // the exclude keys includes.
  const idKeyExcluded = excludedKeys.includes(idKey);
  // for root key only.
  const idKeyOnlyExcluded =
    isRoot &&
    idKeyExcluded &&
    excludedKeys.length === 1 &&
    !includedKeys.length &&
    !handlerKeys.length;

  // special case for root object with only idKey excluded.
  if (idKeyOnlyExcluded) {
    return (o: AnyObject) => {
      const newObj = { ...o };
      delete newObj[idKey];
      return newObj;
    };
  }

  // implicitly add the 'idKey' only for root object.
  const idKeyImplicit =
    isRoot && !idKeyExcluded && !includedKeys.includes(idKey);

  // ResolveOptions for resolveGraph().
  const opts = {
    preserveMissing: true
  };

  return (o: AnyObject) => {
    const newObj = {};

    // if there is at least one excluded key (not including idKey)
    if (excludedKeys.length && !includedKeys.length) {
      merge(newObj, o);
      for (const k of excludedKeys) {
        removeValue(newObj, k, { descendArray: true });
      }
    }

    for (const k of includedKeys) {
      // get value with object graph
      const pathObj = resolveGraph(o, k, opts) ?? {};
      // add the value at the path
      merge(newObj, pathObj);
      // handle positional projection fields.
      if (has(positional, k)) {
        positional[k](newObj);
      }
    }

    // filter out all missing values preserved to support correct merging
    if (includedKeys.length) filterMissing(newObj);

    for (const k of handlerKeys) {
      const value = handlers[k](o);
      if (value === undefined) {
        removeValue(newObj, k, { descendArray: true });
      } else {
        setValue(newObj, k, value);
      }
    }

    if (idKeyImplicit && has(o, idKey)) {
      newObj[idKey] = resolve(o, idKey);
    }

    return newObj;
  };
}
