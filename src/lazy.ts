import { Any, AnyObject, Callback, Predicate } from "./types";
import { assert } from "./util";

/**
 * A value produced by a generator
 */
export interface IteratorResult<T = Any> {
  readonly value?: T;
  readonly done: boolean;
}

/**
 * Represents a stream interface that provides a method to retrieve the next item in a sequence.
 */
interface Stream {
  next: () => IteratorResult;
}

export type Source = Stream | Callback<IteratorResult> | Iterable<Any>;

/**
 * Returns an iterator
 * @param {*} source An iterable source (Array, Function, Generator, or Iterator)
 */
export function Lazy(source: Source): Iterator {
  return source instanceof Iterator ? source : new Iterator(source);
}

/**
 * Concatenate multiple iterators and return a new iterator.
 *
 * @param iterators The iterators to concatenate
 * @returns {Iterator} A new iterator
 */
export function concat(...iterators: Iterator[]): Iterator {
  let index = 0;
  return Lazy(() => {
    while (index < iterators.length) {
      const o = iterators[index].next();
      if (!o.done) return o;
      index++;
    }
    return { done: true };
  });
}

/**
 * Checks whether the given object is compatible with a generator i.e Object{next:Function}
 * @param {*} o An object
 */
function isGenerator(o: Any) {
  return (
    !!o && typeof o === "object" && typeof (o as AnyObject)?.next === "function"
  );
}

function isIterable(o: Any) {
  return (
    !!o &&
    (typeof o === "object" || typeof o === "function") &&
    typeof o[Symbol.iterator] === "function"
  );
}

interface Iteratee {
  op: "map" | "filter";
  fn: Callback<Any>;
}

/**
 * A lazy collection iterator yields a single value at a time upon request.
 */
export class Iterator {
  #iteratees: Iteratee[] = [];
  #buffer: Any[] = [];
  #getNext: Callback<IteratorResult, boolean>;
  #done = false;

  constructor(source: Source) {
    const iter: Stream = isIterable(source)
      ? ((source as Iterable<Any>)[Symbol.iterator]() as Stream)
      : isGenerator(source)
        ? (source as Stream)
        : typeof source === "function"
          ? { next: source }
          : null;

    assert(
      !!iter,
      `Iterator must be initialized with an iterable or function.`
    );

    // index of successfully transformed and yielded item
    let index = -1;
    // current item
    let current: IteratorResult = { done: false };
    // create function to yield the next transformed value
    this.#getNext = () => {
      while (!current.done) {
        current = iter.next();
        if (current.done) break;
        let value = current.value;
        index++;
        const ok = this.#iteratees.every(({ op: action, fn }) => {
          const res = fn(value, index);
          return action === "map" ? !!(value = res) || true : res;
        });
        if (ok) return { value, done: false };
      }
      return { done: true };
    };
  }

  /**
   * Add an iteratee to this lazy sequence
   */
  private push(op: "map" | "filter", fn: Callback<Any>) {
    this.#iteratees.push({ op, fn });
    return this;
  }

  next<T = Any>(): IteratorResult<T> {
    return this.#getNext() as IteratorResult<T>;
  }

  // Iteratees methods

  /**
   * Transform each item in the sequence to a new value
   * @param {Function} f
   */
  map<T = Any>(f: Callback<T>): Iterator {
    return this.push("map", f);
  }

  /**
   * Select only items matching the given predicate
   * @param {Function} f
   */
  filter<T = Any>(f: Predicate<T>): Iterator {
    return this.push("filter", f as Callback<T>);
  }

  /**
   * Take given numbe for values from sequence
   * @param {Number} n A number greater than 0
   */
  take(n: number): Iterator {
    return n > 0 ? this.filter((_: Any) => !(n === 0 || n-- === 0)) : this;
  }

  /**
   * Drop a number of values from the sequence
   * @param {Number} n Number of items to drop greater than 0
   */
  drop(n: number): Iterator {
    return n > 0 ? this.filter((_: Any) => n === 0 || n-- === 0) : this;
  }

  // Transformations

  /**
   * Returns a new lazy object with results of the transformation
   * The entire sequence is realized.
   *
   * @param {Callback<Source, Any[]>} fn Tranform function of type (Array) => (Any)
   */
  transform(fn: Callback<Source, Any[]>): Iterator {
    const self = this;
    let iter: Iterator;
    return Lazy(() => {
      if (!iter) iter = Lazy(fn(self.value()));
      return iter.next();
    });
  }

  // Terminal methods

  /**
   * Returns the fully realized values of the iterators.
   * The return value will be an array unless `lazy.first()` was used.
   * The realized values are cached for subsequent calls.
   */
  value<T>(): T[] {
    while (!this.#done) {
      const { done, value } = this.#getNext();
      if (!done) this.#buffer.push(value);
      this.#done = done;
    }
    return this.#buffer as T[];
  }

  /**
   * Execute the funcion for each value. Will stop when an execution returns false.
   * @param {Function} f
   * @returns {Boolean} false iff `f` return false for AnyVal execution, otherwise true
   */
  each<T = Any>(f: Callback<T>): boolean {
    for (;;) {
      const o = this.next();
      if (o.done) break;
      if ((f(o.value) as Any) === false) return false;
    }
    return true;
  }

  /**
   * Returns the reduction of sequence according the reducing function
   *
   * @param {*} f a reducing function
   * @param {*} initialValue
   */
  reduce<T = Any>(f: Callback<T>, initialValue?: Any): T {
    let o = this.next();

    if (initialValue === undefined && !o.done) {
      initialValue = o.value as T;
      o = this.next();
    }

    while (!o.done) {
      initialValue = f(initialValue, o.value as T);
      o = this.next();
    }

    return initialValue as T;
  }

  /**
   * Returns the number of matched items in the sequence
   */
  size(): number {
    return this.reduce(
      ((acc: number, _: number) => ++acc) as Callback<number>,
      0
    );
  }

  [Symbol.iterator](): Iterator {
    return this;
  }
}
