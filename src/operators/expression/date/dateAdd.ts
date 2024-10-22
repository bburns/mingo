// Date Expression Operators: https://docs.mongodb.com/manual/reference/operator/aggregation/#date-expression-operators

import { computeValue, ExpressionOperator, Options } from "../../../core";
import { Any, AnyObject, TimeUnit } from "../../../types";
import {
  adjustDate,
  computeDate,
  DURATION_IN_MILLIS,
  parseTimezone
} from "./_internal";

/**
 * Increments a Date object by a specified number of time units.
 * @param obj
 * @param expr
 */
export const $dateAdd: ExpressionOperator<Date> = (
  obj: AnyObject,
  expr: AnyObject,
  options: Options
): Date => {
  const args = computeValue(obj, expr, null, options) as {
    startDate: Any;
    unit: TimeUnit;
    amount: number;
    timezone?: string;
  };

  const d = computeDate(obj, expr.startDate, options);

  switch (args.unit) {
    case "year":
      d.setUTCFullYear(d.getUTCFullYear() + args.amount);
      break;
    case "quarter":
      addMonth(d, 3 * args.amount);
      break;
    case "month":
      addMonth(d, args.amount);
      break;
    default:
      d.setTime(d.getTime() + DURATION_IN_MILLIS[args.unit] * args.amount);
  }

  if (args.timezone) {
    const tz = parseTimezone(args.timezone);
    adjustDate(d, tz);
  }

  return d;
};

function addMonth(d: Date, amount: number): void {
  // months start from 0 to 11.
  const m = d.getUTCMonth() + amount;
  const yearOffset = Math.floor(m / 12);
  if (m < 0) {
    const month = (m % 12) + 12;
    d.setUTCFullYear(d.getUTCFullYear() + yearOffset, month, d.getUTCDate());
  } else {
    d.setUTCFullYear(d.getUTCFullYear() + yearOffset, m % 12, d.getUTCDate());
  }
}
