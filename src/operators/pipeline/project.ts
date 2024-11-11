import {
  ComputeOptions,
  computeValue,
  getOperator,
  OperatorType,
  Options,
  PipelineOperator,
  ProjectionOperator
} from "../../core";
import { Iterator } from "../../lazy";
import { Any, AnyObject, Callback } from "../../types";
import {
  assert,
  ensureArray,
  filterMissing,
  has,
  inArray,
  into,
  isArray,
  isEmpty,
  isMissing,
  isNil,
  isNumber,
  isObject,
  isOperator,
  isPrimitive,
  isString,
  notInArray,
  removeValue,
  resolveGraph,
  setValue
} from "../../util";

/**
 * Reshapes each document in the stream, such as by adding new fields or removing existing fields. For each input document, outputs one document.
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

  // result collection
  const expressionKeys = Object.keys(expr);
  let idOnlyExcluded = false;

  // validate inclusion and exclusion
  validateExpression(expr, options);

  const ID_KEY = options.idKey;

  if (inArray(expressionKeys, ID_KEY)) {
    const id = expr[ID_KEY];
    idOnlyExcluded = id === 0 && expressionKeys.length === 1;
  } else {
    // if not specified the add the ID field
    expressionKeys.push(ID_KEY);
  }

  const copts = ComputeOptions.init(options);
  return collection.map(((obj: AnyObject) =>
    processObject(obj, expr, copts.update(obj), expressionKeys)) as Callback);
};

/**
 *Process the expression value for $project operators
 * @param obj The object to use as options
 * @param expr  The experssion object of $project operator
 * @param options The options
 * @param expressionKeys The key in the 'expr' object
 * @returns
 */
function processObject(
  obj: AnyObject,
  expr: AnyObject,
  options: ComputeOptions,
  expressionKeys: string[]
): AnyObject {
  let newObj = {};
  let foundSlice = false;
  let foundExclusion = false;
  // flag indicating whether only the ID key is excluded
  const idOnlyExcluded =
    expr[options.idKey] === 0 && expressionKeys.length === 1;
  const dropKeys: string[] = [];

  if (idOnlyExcluded) {
    dropKeys.push(options.idKey);
  }

  for (const key of expressionKeys) {
    // final computed value of the key
    let value: Any = undefined;

    // expression to associate with key
    const subExpr = expr[key];

    if (key !== options.idKey && inArray([0, false], subExpr)) {
      foundExclusion = true;
    }

    if (key === options.idKey && isEmpty(subExpr)) {
      // tiny optimization here to skip over id
      value = obj[key];
    } else if (isString(subExpr)) {
      value = computeValue(obj, subExpr, key, options);
    } else if (inArray([1, true], subExpr)) {
      // For direct projections, we use the resolved object value
    } else if (isArray(subExpr)) {
      value = subExpr.map(v => {
        const r = computeValue(obj, v, null, options);
        if (isNil(r)) return null;
        return r;
      });
    } else if (isObject(subExpr)) {
      const subExprObj = subExpr as AnyObject;
      const subExprKeys = Object.keys(subExpr);
      const operator = subExprKeys.length == 1 ? subExprKeys[0] : "";

      // first try a projection operator
      const call = getOperator(
        OperatorType.PROJECTION,
        operator,
        options
      ) as ProjectionOperator;
      if (call) {
        // apply the projection operator on the operator expression for the key
        if (operator === "$slice") {
          // $slice is handled differently for aggregation and projection operations
          if (ensureArray(subExprObj[operator]).every(isNumber)) {
            // $slice for projection operation
            value = call(obj, subExprObj[operator], key, options);
            foundSlice = true;
          } else {
            // $slice for aggregation operation
            value = computeValue(obj, subExprObj, key, options);
          }
        } else {
          value = call(obj, subExprObj[operator], key, options);
        }
      } else if (isOperator(operator)) {
        // compute if operator key
        value = computeValue(obj, subExprObj[operator], operator, options);
      } else if (has(obj, key)) {
        // compute the value for the sub expression for the key
        validateExpression(subExprObj, options);
        let target = obj[key];
        if (isArray(target)) {
          value = target.map((o: AnyObject) =>
            processObject(o, subExprObj, options, subExprKeys)
          );
        } else {
          target = isObject(target) ? target : obj;
          value = processObject(
            target as AnyObject,
            subExprObj,
            options,
            subExprKeys
          );
        }
      } else {
        // compute the value for the sub expression for the key
        value = computeValue(obj, subExpr, null, options);
      }
    } else {
      dropKeys.push(key);
      continue;
    }

    // get value with object graph
    const objPathGraph = resolveGraph(obj, key, {
      preserveMissing: true
    }) as AnyObject;

    // add the value at the path
    if (isObject(objPathGraph)) {
      merge(newObj, objPathGraph);
    }

    // if computed add/or remove accordingly
    if (notInArray([0, 1, false, true], subExpr)) {
      if (value === undefined) {
        removeValue(newObj, key, { descendArray: true });
      } else {
        setValue(newObj, key, value);
      }
    }
  }

  // filter out all missing values preserved to support correct merging
  filterMissing(newObj);

  // For the following cases we include all keys on the object that were not explicitly excluded.
  //
  // 1. projection included $slice operator
  // 2. some fields were explicitly excluded
  // 3. only the id field was excluded
  if (foundSlice || foundExclusion || idOnlyExcluded) {
    newObj = into({}, obj, newObj);
    if (dropKeys.length > 0) {
      for (const k of dropKeys) {
        removeValue(newObj, k, { descendArray: true });
      }
    }
  }

  return newObj;
}

/**
 * Validate inclusion and exclusion values in expression
 *
 * @param {Object} expr The expression given for the projection
 */
function validateExpression(expr: AnyObject, options: Options): void {
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

/**
 * Deep merge objects or arrays. When the inputs have unmergeable types, the  right hand value is returned.
 * If inputs are arrays and options.flatten is set, elements in the same position are merged together.
 * Remaining elements are appended to the target object.
 *
 * @param target Target object to merge into.
 * @param input  Source object to merge from.
 */
function merge(target: Any, input: Any): Any {
  // take care of missing inputs
  if (isMissing(target) || isNil(target)) return input;
  if (isMissing(input) || isNil(input)) return target;
  if (isPrimitive(target) || isPrimitive(input)) return input;
  if (isArray(target) && isArray(input)) {
    assert(
      target.length === input.length,
      "arrays must be of equal length to merge."
    );
  }
  for (const k in input as AnyObject) {
    target[k] = merge(target[k], input[k]);
  }
  return target;
}
