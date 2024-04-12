/**
 * Utility constants and functions
 */

import {
  AnyVal,
  ArrayOrObject,
  Callback,
  Comparator,
  GroupByOutput,
  HashFunction,
  JsType,
  RawArray,
  RawObject
} from "./types";

/** Represents an error reported by the mingo library. */
export class MingoError extends Error {}

export const MAX_INT = 2147483647;
export const MIN_INT = -2147483648;
export const MAX_LONG = Number.MAX_SAFE_INTEGER;
export const MIN_LONG = Number.MIN_SAFE_INTEGER;

// special value to identify missing items. treated differently from undefined
const MISSING = Symbol("missing");

const CYCLE_FOUND_ERROR = Object.freeze(
  new Error("mingo: cycle detected while processing object/array")
) as Error;

const OBJECT_TAG = "[object Object]";
const OBJECT_TYPE_RE = /^\[object ([a-zA-Z0-9]+)\]$/;

type Constructor = new (...args: RawArray) => AnyVal;

/**
 * Uses the simple hash method as described in Effective Java.
 * @see https://stackoverflow.com/a/113600/1370481
 * @param value The value to hash
 * @returns {number}
 */
const DEFAULT_HASH_FUNCTION: HashFunction = (value: AnyVal): number => {
  const s = stringify(value);
  let hash = 0;
  let i = s.length;
  while (i) hash = ((hash << 5) - hash) ^ s.charCodeAt(--i);
  return hash >>> 0;
};

/** Options to resolve() and resolveGraph() functions */
interface ResolveOptions {
  unwrapArray?: boolean;
  preserveMissing?: boolean;
  preserveKeys?: boolean;
}

// no array, object, or function types
const JS_SIMPLE_TYPES = new Set<JsType>([
  "null",
  "undefined",
  "boolean",
  "number",
  "string",
  "date",
  "regexp"
]);

/** MongoDB sort comparison order. https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order */
const SORT_ORDER_BY_TYPE: Record<JsType, number> = {
  null: 0,
  undefined: 0,
  number: 1,
  string: 2,
  object: 3,
  array: 4,
  boolean: 5,
  date: 6,
  regexp: 7,
  function: 8
};

/**
 * Compare function which adheres to MongoDB comparison order.
 *
 * @param a The first value
 * @param b The second value
 * @returns {Number}
 */
export const compare = <T = AnyVal>(a: T, b: T): number => {
  if (a === MISSING) a = undefined;
  if (b === MISSING) b = undefined;
  const [u, v] = [a, b].map(
    n => SORT_ORDER_BY_TYPE[getType(n).toLowerCase() as JsType]
  );
  if (u !== v) return u - v;
  // number | string | date
  if (u === 1 || u === 2 || u === 6) {
    if ((a as number) < (b as number)) return -1;
    if ((a as number) > (b as number)) return 1;
    return 0;
  }
  // check for equivalence equality
  if (isEqual(a, b)) return 0;
  if ((a as number) < (b as number)) return -1;
  if ((a as number) > (b as number)) return 1;
  // if we get here we are comparing a type that does not make sense.
  return 0;
};

export function assert(condition: boolean, message: string): void {
  if (!condition) throw new MingoError(message);
}

/**
 * Returns the name of type as specified in the tag returned by a call to Object.prototype.toString
 * @param v A value
 */
export const getType = (v: AnyVal): string =>
  OBJECT_TYPE_RE.exec(Object.prototype.toString.call(v) as string)[1];
export const isBoolean = (v: AnyVal): v is boolean => typeof v === "boolean";
export const isString = (v: AnyVal): v is string => typeof v === "string";
export const isSymbol = (v: AnyVal): boolean => typeof v === "symbol";
export const isNumber = (v: AnyVal): v is number =>
  !isNaN(v as number) && typeof v === "number";
export const isBigInt = (v: AnyVal): v is bigint =>
  !isNaN(v as number) && typeof v === "bigint";
export const isNotNaN = (v: AnyVal) =>
  !(isNaN(v as number) && typeof v === "number");
export const isArray = Array.isArray;
export const isObject = (v: AnyVal): v is object => {
  if (!v) return false;
  const proto = Object.getPrototypeOf(v) as AnyVal;
  return (
    (proto === Object.prototype || proto === null) &&
    OBJECT_TAG === Object.prototype.toString.call(v)
  );
};
//  objects, arrays, functions, date, custom object
export const isObjectLike = (v: AnyVal): boolean => v === Object(v);
export const isDate = (v: AnyVal): v is Date => v instanceof Date;
export const isRegExp = (v: AnyVal): v is RegExp => v instanceof RegExp;
export const isFunction = (v: AnyVal): boolean => typeof v === "function";
export const isNil = (v: AnyVal): boolean => v === null || v === undefined;
export const inArray = (arr: AnyVal[], item: AnyVal): boolean =>
  arr.includes(item);
export const notInArray = (arr: RawArray, item: AnyVal): boolean =>
  !inArray(arr, item);
export const truthy = (arg: AnyVal, strict = true): boolean =>
  !!arg || (strict && arg === "");
export const isEmpty = (x: AnyVal): boolean =>
  isNil(x) ||
  (isString(x) && !x) ||
  (x instanceof Array && x.length === 0) ||
  (isObject(x) && Object.keys(x).length === 0);

export const isMissing = (v: AnyVal): boolean => v === MISSING;
/** ensure a value is an array or wrapped within one. */
export const ensureArray = <T>(x: T | T[]): T[] =>
  x instanceof Array ? x : [x];

export const has = (obj: object, prop: string): boolean =>
  !!obj && (Object.prototype.hasOwnProperty.call(obj, prop) as boolean);

const isTypedArray = (v: AnyVal): boolean =>
  typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(v);

const INSTANCE_CLONE = [isDate, isRegExp, isTypedArray];
const cloneInternal = (val: AnyVal, refs: Set<AnyVal>): AnyVal => {
  if (isNil(val)) return val;
  if (refs.has(val)) throw CYCLE_FOUND_ERROR;
  const ctor = val.constructor as Constructor;
  if (INSTANCE_CLONE.some(f => f(val))) return new ctor(val);
  try {
    refs.add(val);
    if (isArray(val)) return val.map(v => cloneInternal(v, refs)) as AnyVal;
    if (isObject(val)) {
      const res = {};
      for (const k in val) res[k] = cloneInternal(val[k], refs);
      return res;
    }
  } finally {
    refs.delete(val);
  }
  // primitive, non-buffer reference, or custom type
  return val;
};

/**
 * Deep clone an object. Value types and immutable objects are returned as is.
 */
export const cloneDeep = (obj: AnyVal): AnyVal => cloneInternal(obj, new Set());

/** Options to merge function */
interface MergeOptions {
  flatten?: boolean;
  skipValidation?: boolean;
}

const mergeable = <T>(left: T, right: T): boolean =>
  (isObject(left) && isObject(right)) || (isArray(left) && isArray(right));

/**
 * Deep merge objects or arrays.
 * When the inputs have unmergeable types, the  right hand value is returned.
 * If inputs are arrays and options.flatten is set, elements in the same position are merged together. Remaining elements are appended to the target object.
 * If options.flatten is false, the right hand value is just appended to the left-hand value.
 * @param target {Object|Array} the target to merge into
 * @param obj {Object|Array} the source object
 */
export function merge(
  target: AnyVal,
  obj: AnyVal,
  options?: MergeOptions
): AnyVal {
  // default options
  options = options || { flatten: false };

  // take care of missing inputs
  if (isMissing(target) || isNil(target)) return obj;
  if (isMissing(obj) || isNil(obj)) return target;

  // fail only on initial input.
  if (!mergeable(target, obj)) {
    if (options.skipValidation) return obj || target;
    throw Error("mismatched types. must both be array or object");
  }

  // skip validation after initial input.
  options.skipValidation = true;

  if (isArray(target)) {
    const result = target as RawArray;
    const input = obj as RawArray;

    if (options.flatten) {
      let i = 0;
      let j = 0;
      while (i < result.length && j < input.length) {
        result[i] = merge(result[i++], input[j++], options) as RawArray;
      }
      while (j < input.length) {
        result.push(obj[j++] as ArrayOrObject);
      }
    } else {
      into(result, input);
    }
  } else {
    for (const k in obj as RawObject) {
      target[k] = merge(
        target[k] as ArrayOrObject,
        obj[k] as ArrayOrObject,
        options
      );
    }
  }

  return target;
}

function buildHashIndex(
  arr: RawArray,
  hashFunction: HashFunction = DEFAULT_HASH_FUNCTION
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  arr.forEach((o, i) => {
    const h = hashCode(o, hashFunction);
    if (map.has(h)) {
      if (!map.get(h).some(j => isEqual(arr[j], o))) {
        map.get(h).push(i);
      }
    } else {
      map.set(h, [i]);
    }
  });
  return map;
}

/**
 * Returns the intersection of multiple arrays.
 *
 * @param  {Array} input An array of arrays from which to find intersection.
 * @param  {Function} hashFunction Custom function to hash values, default the hashCode method
 * @return {Array} Array of intersecting values.
 */
export function intersection(
  input: RawArray[],
  hashFunction: HashFunction = DEFAULT_HASH_FUNCTION
): RawArray {
  // if any array is empty, there is no intersection
  if (input.some(arr => arr.length == 0)) return [];
  if (input.length === 1) return Array.from(input);

  // sort input arrays by to get smallest array
  // const sorted = sortBy(input, (a: RawArray) => a.length) as RawArray[];
  const sortedIndex = sortBy(
    input.map((a, i) => [i, a.length]),
    (a: [number, number]) => a[1]
  ) as Array<[number, number]>;
  // get the smallest
  const smallest = input[sortedIndex[0][0]];
  // get hash index of smallest array
  const map = buildHashIndex(smallest, hashFunction);
  // hashIndex for remaining arrays.
  const rmap = new Map<number, Map<string, number[]>>();
  // final intersection results and index of first occurrence.
  const results = new Array<[AnyVal, [number, number]]>();
  map.forEach((v, k) => {
    const lhs = v.map(j => smallest[j]);
    const res = lhs.map(_ => 0);
    // used to track first occurence of value in order of the original input array.
    const stable = lhs.map(_ => [sortedIndex[0][0], 0]);
    let found = false;
    for (let i = 1; i < input.length; i++) {
      const [currIndex, _] = sortedIndex[i];
      const arr = input[currIndex];
      if (!rmap.has(i)) rmap.set(i, buildHashIndex(arr));
      // we found a match. let's confirm.
      if (rmap.get(i).has(k)) {
        const rhs = rmap
          .get(i)
          .get(k)
          .map(j => arr[j]);

        // confirm the intersection with an equivalence check.
        found = lhs
          .map((s, n) =>
            rhs.some((t, m) => {
              // we expect only one to match here since these are just collisions.
              const p = res[n];
              if (isEqual(s, t)) {
                res[n]++;
                // track position of value ordering for stability.
                if (currIndex < stable[n][0]) {
                  stable[n] = [currIndex, rmap.get(i).get(k)[m]];
                }
              }
              return p < res[n];
            })
          )
          .some(Boolean);
      }

      // found nothing, so exclude value. this was just a hash collision.
      if (!found) return;
    }

    // extract value into result if we found an intersection.
    // we find an intersection if the frequency counter matches the count of the remaining arrays.
    if (found) {
      into(
        results,
        res
          .map((n, i) => {
            return n === input.length - 1 ? [lhs[i], stable[i]] : MISSING;
          })
          .filter(n => n !== MISSING)
      );
    }
  });

  return results
    .sort((a, b) => {
      const [_i, [u, m]] = a;
      const [_j, [v, n]] = b;
      const r = compare(u, v);
      if (r !== 0) return r;
      return compare(m, n);
    })
    .map(v => v[0]);
}

/**
 * Flatten the array
 *
 * @param {Array} xs The array to flatten
 * @param {Number} depth The number of nested lists to iterate
 */
export function flatten(xs: RawArray, depth = 0): RawArray {
  const arr = new Array<AnyVal>();
  function flatten2(ys: RawArray, n: number) {
    for (let i = 0, len = ys.length; i < len; i++) {
      if (isArray(ys[i]) && (n > 0 || n < 0)) {
        flatten2(ys[i] as RawArray, Math.max(-1, n - 1));
      } else {
        arr.push(ys[i]);
      }
    }
  }
  flatten2(xs, depth);
  return arr;
}

/** Returns all members of the value in an object literal. */
const getMembersOf = (value: AnyVal): [RawObject, AnyVal] => {
  let [proto, names] = [
    Object.getPrototypeOf(value),
    Object.getOwnPropertyNames(value)
  ] as [AnyVal, string[]];
  // save effective prototype
  let activeProto = proto;
  // traverse the prototype hierarchy until we get property names or hit the bottom prototype.
  while (
    !names.length &&
    proto !== Object.prototype &&
    proto !== Array.prototype
  ) {
    activeProto = proto;
    names = Object.getOwnPropertyNames(proto);
    proto = Object.getPrototypeOf(proto);
  }
  const o = {};
  names.forEach(k => (o[k] = (value as RawObject)[k]));
  return [o, activeProto];
};

type Stringer = { toString(): string };

/**
 * Determine whether two values are the same or strictly equivalent.
 * Checking whether values are the same only applies to built in objects.
 * For user-defined objects this checks for only referential equality so
 * two different instances with the same values are not equal.
 *
 * @param  {*}  a The first value
 * @param  {*}  b The second value
 * @return {Boolean} True if value contents are the same, false otherwise.
 */
export function isEqual(a: AnyVal, b: AnyVal): boolean {
  // strictly equal must be equal. matches referentially equal values.
  if (a === b || Object.is(a, b)) return true;
  // get the constructor for non-nil values
  const ctor = (!!a && a.constructor) || a;
  // cannot be equal given first constraint
  if (
    a === null ||
    b === null ||
    a === undefined ||
    b === undefined ||
    ctor !== b.constructor ||
    ctor === Function
  ) {
    return false;
  }
  // iterate array or object keys to compare them
  if (ctor === Array || ctor === Object) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    if (new Set([...aKeys, ...bKeys]).size != aKeys.length) return false;
    for (const k of aKeys) if (!isEqual(a[k], b[k])) return false;
    return true;
  }
  // toString() compare all supported types including custom ones.
  const proto = Object.getPrototypeOf(a) as object;
  const cmp =
    isTypedArray(a) ||
    (proto !== Object.prototype &&
      proto !== Array.prototype &&
      (Object.prototype.hasOwnProperty.call(proto, "toString") as boolean));
  return cmp && (a as Stringer).toString() === (b as Stringer).toString();
}

/**
 * Return a new unique version of the collection
 * @param  {Array} input The input collection
 * @return {Array}
 */
export function unique(
  input: RawArray,
  hashFunction: HashFunction = DEFAULT_HASH_FUNCTION
): RawArray {
  const result: RawArray = input.map(_ => MISSING);
  buildHashIndex(input, hashFunction).forEach((v, _) => {
    v.forEach(i => (result[i] = input[i]));
  });
  return result.filter(v => v !== MISSING);
}

type HasToString = { toString(): string };
const toString = (v: AnyVal, cycle: Set<AnyVal>): string => {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  const ctor = v.constructor;
  switch (ctor) {
    case RegExp:
    case Number:
    case Boolean:
    case Function:
    case Symbol:
      return (v as HasToString).toString();
    case String:
      return JSON.stringify(v);
    case Date:
      return (v as Date).toISOString();
  }
  if (isTypedArray(v))
    return ctor.name + "[" + (v as HasToString).toString() + "]";
  if (cycle.has(v)) throw CYCLE_FOUND_ERROR;
  try {
    cycle.add(v);
    if (isArray(v)) {
      return "[" + v.map(s => toString(s, cycle)).join(",") + "]";
    }
    if (ctor === Object) {
      return (
        "{" +
        Object.keys(v)
          .sort()
          .map(k => k + ":" + toString(v[k], cycle))
          .join(",") +
        "}"
      );
    }

    // use toString represenation of custom-type
    const proto = Object.getPrototypeOf(v) as object;
    if (
      proto !== Object.prototype &&
      proto !== Array.prototype &&
      (Object.prototype.hasOwnProperty.call(proto, "toString") as boolean)
    ) {
      return (
        ctor.name + "(" + JSON.stringify((v as HasToString).toString()) + ")"
      );
    }
    // no toString() for custom object, so process all members.
    const [members, _] = getMembersOf(v);
    return ctor.name + toString(members, cycle);
  } finally {
    cycle.delete(v);
  }
};

/**
 * Encode value to string using a simple non-colliding stable scheme.
 * Handles user-defined types by processing keys on first non-empty prototype.
 * If a user-defined type provides a "toJSON" function, it is used.
 *
 * @param value The value to convert to a string representation.
 * @returns {String}
 */
export const stringify = (value: AnyVal): string => toString(value, new Set());

/**
 * Generate hash code
 * This selected function is the result of benchmarking various hash functions.
 * This version performs well and can hash 10^6 documents in ~3s with on average 100 collisions.
 *
 * @param value
 * @returns {number|null}
 */
export function hashCode(
  value: AnyVal,
  hashFunction?: HashFunction
): string | null {
  hashFunction = hashFunction || DEFAULT_HASH_FUNCTION;
  if (isNil(value)) return null;
  return hashFunction(value).toString();
}

/**
 * Returns a (stably) sorted copy of list, ranked in ascending order by the results of running each value through iteratee
 *
 * This implementation treats null/undefined sort keys as less than every other type
 *
 * @param {Array}   collection
 * @param {Function} keyFn The sort key function used to resolve sort keys
 * @param {Function} comparator The comparator function to use for comparing keys. Defaults to standard comparison via `compare(...)`
 * @return {Array} Returns a new sorted array by the given key and comparator function
 */
export function sortBy<T = AnyVal>(
  collection: RawArray,
  keyFn: Callback<T>,
  comparator: Comparator<T> = compare
): RawArray {
  if (isEmpty(collection)) return collection;

  type Pair = [T, AnyVal];
  const sorted = new Array<Pair>();
  const result = new Array<AnyVal>();

  for (let i = 0; i < collection.length; i++) {
    const obj = collection[i];
    const key = keyFn(obj, i);
    if (isNil(key)) {
      result.push(obj);
    } else {
      sorted.push([key, obj]);
    }
  }

  // use native array sorting but enforce stableness
  sorted.sort((a, b) => comparator(a[0], b[0]));
  return into(
    result,
    sorted.map((o: RawArray) => o[1])
  ) as RawArray;
}

/**
 * Groups the collection into sets by the returned key
 *
 * @param collection
 * @param keyFn {Function} to compute the group key of an item in the collection
 * @returns {GroupByOutput}
 */
export function groupBy(
  collection: RawArray,
  keyFn: Callback<AnyVal>,
  hashFunction: HashFunction = DEFAULT_HASH_FUNCTION
): GroupByOutput {
  if (collection.length < 1) return new Map();

  // map of hash to collided values
  const lookup = new Map<string, Array<AnyVal>>();
  // map of raw key values to objects.
  const result = new Map<AnyVal, Array<AnyVal>>();

  for (let i = 0; i < collection.length; i++) {
    const obj = collection[i];
    const key = keyFn(obj, i);
    const hash = hashCode(key, hashFunction);

    if (hash === null) {
      if (result.has(null)) {
        result.get(null).push(obj);
      } else {
        result.set(null, [obj]);
      }
    } else {
      // find if we can match a hash for which the value is equivalent.
      // this is used to deal with collisions.
      const existingKey = lookup.has(hash)
        ? lookup.get(hash).find(k => isEqual(k, key))
        : null;

      // collision detected or first time seeing key
      if (isNil(existingKey)) {
        // collision detected or first entry so we create a new group.
        result.set(key, [obj]);
        // upload the lookup with the collided key
        if (lookup.has(hash)) {
          lookup.get(hash).push(key);
        } else {
          lookup.set(hash, [key]);
        }
      } else {
        // key exists
        result.get(existingKey).push(obj);
      }
    }
  }

  return result;
}

// max elements to push.
// See argument limit https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply
const MAX_ARRAY_PUSH = 50000;

/**
 * Merge elements into the dest
 *
 * @param {*} target The target object
 * @param {*} rest The array of elements to merge into dest
 */
export function into(
  target: ArrayOrObject,
  ...rest: Array<ArrayOrObject>
): ArrayOrObject {
  if (target instanceof Array) {
    return rest.reduce(
      ((acc, arr: RawArray) => {
        // push arrary in batches to handle large inputs
        let i = Math.ceil(arr.length / MAX_ARRAY_PUSH);
        let begin = 0;
        while (i-- > 0) {
          Array.prototype.push.apply(
            acc,
            arr.slice(begin, begin + MAX_ARRAY_PUSH)
          );
          begin += MAX_ARRAY_PUSH;
        }
        return acc;
      }) as Callback<typeof target>,
      target
    );
  } else {
    // merge objects. same behaviour as Object.assign
    return rest.filter(isObjectLike).reduce((acc, item) => {
      Object.assign(acc, item);
      return acc;
    }, target);
  }
}

/**
 * This is a generic memoization function
 *
 * This implementation uses a cache independent of the function being memoized
 * to allow old values to be garbage collected when the memoized function goes out of scope.
 *
 * @param {*} fn The function object to memoize
 */
export function memoize(
  fn: Callback<AnyVal>,
  hashFunction: HashFunction = DEFAULT_HASH_FUNCTION
): Callback<AnyVal> {
  return ((memo: RawObject) => {
    return (...args: RawArray): AnyVal => {
      const key = hashCode(args, hashFunction) || "";
      if (!has(memo, key)) {
        memo[key] = fn.apply(this, args) as AnyVal;
      }
      return memo[key];
    };
  })({
    /* storage */
  });
}

// mingo internal

/**
 * Retrieve the value of a given key on an object
 * @param obj
 * @param key
 * @returns {*}
 * @private
 */
function getValue(obj: ArrayOrObject, key: string | number): AnyVal {
  return isObjectLike(obj) ? obj[key] : undefined;
}

/**
 * Unwrap a single element array to specified depth
 * @param {Array} arr
 * @param {Number} depth
 */
function unwrap(arr: RawArray, depth: number): RawArray {
  if (depth < 1) return arr;
  while (depth-- && arr.length === 1) arr = arr[0] as RawArray;
  return arr;
}

/**
 * Resolve the value of the field (dot separated) on the given object
 * @param obj {Object} the object context
 * @param selector {String} dot separated path to field
 * @returns {*}
 */
export function resolve(
  obj: ArrayOrObject,
  selector: string,
  options?: ResolveOptions
): AnyVal {
  let depth = 0;

  function resolve2(o: ArrayOrObject, path: Array<string>): AnyVal {
    let value: AnyVal = o;
    for (let i = 0; i < path.length; i++) {
      const field = path[i];
      const isText = /^\d+$/.exec(field) === null;

      // using instanceof to aid typescript compiler
      if (isText && value instanceof Array) {
        // On the first iteration, we check if we received a stop flag.
        // If so, we stop to prevent iterating over a nested array value
        // on consecutive object keys in the selector.
        if (i === 0 && depth > 0) break;

        depth += 1;
        // only look at the rest of the path
        const subpath = path.slice(i);
        value = value.reduce<RawArray>((acc: RawArray, item: ArrayOrObject) => {
          const v = resolve2(item, subpath);
          if (v !== undefined) acc.push(v);
          return acc;
        }, []);
        break;
      } else {
        value = getValue(value as ArrayOrObject, field);
      }
      if (value === undefined) break;
    }
    return value;
  }

  const result = JS_SIMPLE_TYPES.has(getType(obj).toLowerCase() as JsType)
    ? obj
    : resolve2(obj, selector.split("."));

  return result instanceof Array && options?.unwrapArray
    ? unwrap(result, depth)
    : result;
}

/**
 * Returns the full object to the resolved value given by the selector.
 * This function excludes empty values as they aren't practically useful.
 *
 * @param obj {Object} the object context
 * @param selector {String} dot separated path to field
 */
export function resolveGraph(
  obj: ArrayOrObject,
  selector: string,
  options?: ResolveOptions
): ArrayOrObject | undefined {
  const names: string[] = selector.split(".");
  const key = names[0];
  // get the next part of the selector
  const next = names.slice(1).join(".");
  const isIndex = /^\d+$/.exec(key) !== null;
  const hasNext = names.length > 1;
  let result: AnyVal;
  let value: AnyVal;

  if (obj instanceof Array) {
    if (isIndex) {
      result = getValue(obj, Number(key)) as ArrayOrObject;
      if (hasNext) {
        result = resolveGraph(result as ArrayOrObject, next, options);
      }
      result = [result];
    } else {
      result = [];
      for (const item of obj) {
        value = resolveGraph(item as ArrayOrObject, selector, options);
        if (options?.preserveMissing) {
          if (value === undefined) {
            value = MISSING;
          }
          (result as RawArray).push(value);
        } else if (value !== undefined) {
          (result as RawArray).push(value);
        }
      }
    }
  } else {
    value = getValue(obj, key);
    if (hasNext) {
      value = resolveGraph(value as ArrayOrObject, next, options);
    }
    if (value === undefined) return undefined;
    result = options?.preserveKeys ? { ...obj } : {};
    (result as RawObject)[key] = value;
  }

  return result as ArrayOrObject;
}

/**
 * Filter out all MISSING values from the object in-place
 *
 * @param obj The object to filter
 */
export function filterMissing(obj: ArrayOrObject): void {
  if (obj instanceof Array) {
    for (let i = obj.length - 1; i >= 0; i--) {
      if (obj[i] === MISSING) {
        obj.splice(i, 1);
      } else {
        filterMissing(obj[i] as ArrayOrObject);
      }
    }
  } else if (isObject(obj)) {
    for (const k in obj) {
      if (has(obj, k)) {
        filterMissing(obj[k] as ArrayOrObject);
      }
    }
  }
}

/** Options passed to the walk function. */
export interface WalkOptions {
  buildGraph?: boolean;
  descendArray?: boolean;
}

const NUMBER_RE = /^\d+$/;

/**
 * Walk the object graph and execute the given transform function
 *
 * @param  {Object|Array} obj   The object to traverse.
 * @param  {String} selector    The selector to navigate.
 * @param  {Callback} fn Callback to execute for value at the end the traversal.
 * @param  {WalkOptions} options The opetions to use for the function.
 * @return {*}
 */
export function walk(
  obj: ArrayOrObject,
  selector: string,
  fn: Callback<void>,
  options?: WalkOptions
): void {
  const names = selector.split(".");
  const key = names[0];
  const next = names.slice(1).join(".");

  if (names.length === 1) {
    if (isObject(obj) || (isArray(obj) && NUMBER_RE.test(key))) {
      fn(obj, key);
    }
  } else {
    // force the rest of the graph while traversing
    if (options?.buildGraph && isNil(obj[key])) {
      obj[key] = {};
    }

    // get the next item
    const item = obj[key] as ArrayOrObject;
    // nothing more to do
    if (!item) return;
    // we peek to see if next key is an array index.
    const isNextArrayIndex = !!(names.length > 1 && NUMBER_RE.test(names[1]));
    // if we have an array value but the next key is not an index and the 'descendArray' option is set,
    // we walk each item in the array separately. This allows for handling traversing keys for objects
    // nested within an array.
    //
    // Eg: Given { array: [ {k:1}, {k:2}, {k:3} ] }
    //  - individual objecs can be traversed with "array.k"
    //  - a specific object can be traversed with "array.1"
    if (item instanceof Array && options?.descendArray && !isNextArrayIndex) {
      item.forEach(((e: ArrayOrObject) =>
        walk(e, next, fn, options)) as Callback<void>);
    } else {
      walk(item, next, fn, options);
    }
  }
}

/**
 * Set the value of the given object field
 *
 * @param obj {Object|Array} the object context
 * @param selector {String} path to field
 * @param value {*} the value to set. if it is function, it is invoked with the old value and must return the new value.
 */
export function setValue(
  obj: ArrayOrObject,
  selector: string,
  value: AnyVal
): void {
  walk(
    obj,
    selector,
    ((item: RawObject, key: string) => {
      item[key] = isFunction(value) ? (value as Callback)(item[key]) : value;
    }) as Callback<void>,
    { buildGraph: true }
  );
}

/**
 * Removes an element from the container.
 * If the selector resolves to an array and the leaf is a non-numeric key,
 * the remove operation will be performed on objects of the array.
 *
 * @param obj {ArrayOrObject} object or array
 * @param selector {String} dot separated path to element to remove
 */
export function removeValue(
  obj: ArrayOrObject,
  selector: string,
  options?: Pick<WalkOptions, "descendArray">
): void {
  walk(
    obj,
    selector,
    ((item: AnyVal, key: string) => {
      if (item instanceof Array) {
        if (/^\d+$/.test(key)) {
          item.splice(parseInt(key), 1);
        } else if (options && options.descendArray) {
          for (const elem of item) {
            if (isObject(elem)) {
              delete (elem as RawObject)[key];
            }
          }
        }
      } else if (isObject(item)) {
        delete item[key];
      }
    }) as Callback<void>,
    options
  );
}

const OPERATOR_NAME_PATTERN = /^\$[a-zA-Z0-9_]+$/;
/**
 * Check whether the given name passes for an operator. We assume AnyVal field name starting with '$' is an operator.
 * This is cheap and safe to do since keys beginning with '$' should be reserved for internal use.
 * @param {String} name
 */
export function isOperator(name: string): boolean {
  return OPERATOR_NAME_PATTERN.test(name);
}

/**
 * Simplify expression for easy evaluation with query operators map
 * @param expr
 * @returns {*}
 */
export function normalize(expr: AnyVal): AnyVal {
  // normalized primitives
  if (JS_SIMPLE_TYPES.has(getType(expr).toLowerCase() as JsType)) {
    return isRegExp(expr) ? { $regex: expr } : { $eq: expr };
  }

  // normalize object expression. using ObjectLike handles custom types
  if (isObjectLike(expr)) {
    const exprObj = expr as RawObject;
    // no valid query operator found, so we do simple comparison
    if (!Object.keys(exprObj).some(isOperator)) {
      return { $eq: expr };
    }

    // ensure valid regex
    if (has(expr as RawObject, "$regex")) {
      const newExpr = { ...(expr as RawObject) };
      newExpr["$regex"] = new RegExp(
        expr["$regex"] as string,
        expr["$options"] as string
      );
      delete newExpr["$options"];
      return newExpr;
    }
  }

  return expr;
}

/**
 * Find the insert index for the given key in a sorted array.
 *
 * @param {*} sorted The sorted array to search
 * @param {*} item The search key
 */
export function findInsertIndex(sorted: RawArray, item: AnyVal): number {
  // uses binary search
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = Math.round(lo + (hi - lo) / 2);
    if (compare(item, sorted[mid]) < 0) {
      hi = mid - 1;
    } else if (compare(item, sorted[mid]) > 0) {
      lo = mid + 1;
    } else {
      return mid;
    }
  }
  return lo;
}
