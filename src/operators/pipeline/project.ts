import {
  ComputeOptions,
  computeValue,
  getOperator,
  Options,
  PipelineOperator,
  ProjectionOperator
} from "../../core";
import { Iterator } from "../../lazy";
import { Any, AnyObject } from "../../types";
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
  const copts = ComputeOptions.init(options);
  return collection.map(prepareHandler(expr, copts, true));
};

/**
 * Validate inclusion and exclusion values in expression
 *
 * @param {Object} expr The expression given for the projection
 */
function checkExpression(expr: AnyObject, options: Options): void {
  const check = [false, false];
  for (const [k, v] of Object.entries(expr)) {
    if (k === options?.idKey) return;
    if (v === 0 || v === false) {
      check[0] = true;
    } else if (v === 1 || v === true) {
      check[1] = true;
    }
    assert(
      !(check[0] && check[1]),
      "Projection cannot have a mix of inclusion and exclusion."
    );
  }
}

type Handler = (_: AnyObject) => Any;

/**
 * Prepare the expression for projection.
 * @param expr  The projection expression
 * @param options The options
 * @returns
 */
function prepareHandler(
  expr: AnyObject,
  options: ComputeOptions,
  isRoot: boolean = false
): Handler {
  const idKey = options.idKey;
  const expressionKeys = Object.keys(expr);
  const excludedKeys = new Array<string>();
  const includedKeys = new Array<string>();
  const handlers: Record<string, Handler> = {};

  for (const key of expressionKeys) {
    // get expression associated with key
    const subExpr = expr[key];

    if (isNumber(subExpr) || isBoolean(subExpr)) {
      if (subExpr) {
        includedKeys.push(key);
      } else {
        excludedKeys.push(key);
      }
    } else if (isArray(subExpr)) {
      handlers[key] = (o: AnyObject) =>
        subExpr.map(v => computeValue(o, v, null, options.update(o)) ?? null);
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
            computeValue(o, subExpr, key, options.update(o));
        } else {
          handlers[key] = (o: AnyObject) =>
            projectFn(o, subExpr[operator], key, options.update(o));
        }
      } else if (isOperator(operator)) {
        // pipelien projection
        handlers[key] = (o: AnyObject) =>
          computeValue(o, subExpr[operator], operator, options);
      } else {
        // repeat for nested expression
        checkExpression(subExpr as AnyObject, options);
        handlers[key] = (o: AnyObject) => {
          if (!has(o, key)) return computeValue(o, subExpr, null, options);
          // ensure that the root object is passed down.
          if (isRoot) options.update(o);
          const target = resolve(o, key);
          const fn = prepareHandler(subExpr as AnyObject, options);
          if (isArray(target)) return target.map(fn);
          if (isObject(target)) return fn(target as AnyObject);
          return fn(o);
        };
      }
    } else {
      handlers[key] =
        isString(subExpr) && subExpr[0] === "$"
          ? (o: AnyObject) => computeValue(o, subExpr, key, options)
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

    for (const key of includedKeys) {
      // get value with object graph
      const pathObj = resolveGraph(o, key, opts) ?? {};
      // add the value at the path
      merge(newObj, pathObj);
    }

    // filter out all missing values preserved to support correct merging
    if (includedKeys.length) filterMissing(newObj);

    for (const key of handlerKeys) {
      const value = handlers[key](o);
      if (value === undefined) {
        removeValue(newObj, key, { descendArray: true });
      } else {
        setValue(newObj, key, value);
      }
    }

    if (idKeyImplicit && has(o, idKey)) {
      newObj[idKey] = resolve(o, idKey);
    }

    return newObj;
  };
}
