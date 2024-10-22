import { runTest, testPath } from "../../../support";

const fixtures: [string, string, number?, string?, string?][] = [
  // [<Results>, <Args>,...]
  // [<result>, unit, binSize, ?timezone, ?startOfWeek]
  ["2010-01-01T10:45:20.45Z", "millisecond"],
  ["2010-01-01T10:45:20Z", "second"],
  ["2010-01-01T10:45:00Z", "minute"],
  ["2010-01-01T10:00:00Z", "hour"],
  ["2010-01-01T00:00:00Z", "day"],
  ["2009-12-27T00:00:00Z", "week"],
  ["2010-01-01T00:00:00Z", "month"],
  ["2010-01-01T00:00:00Z", "quarter"],
  ["2010-01-01T00:00:00Z", "year"],
  ["2010-01-01T10:45:20.45Z", "millisecond", 2],
  ["2010-01-01T10:45:20Z", "second", 2],
  ["2010-01-01T10:44:00Z", "minute", 2],
  ["2010-01-01T10:00:00Z", "hour", 2],
  ["2009-12-31T00:00:00Z", "day", 2],
  ["2009-12-20T00:00:00Z", "week", 2],
  ["2010-01-01T00:00:00Z", "month", 2],
  ["2010-01-01T00:00:00Z", "quarter", 2],
  ["2010-01-01T00:00:00Z", "year", 2],
  ["2010-01-01T10:45:20.445Z", "millisecond", 7],
  ["2010-01-01T10:45:16Z", "second", 7],
  ["2010-01-01T10:42:00Z", "minute", 7],
  ["2010-01-01T10:00:00Z", "hour", 7],
  ["2009-12-26T00:00:00Z", "day", 7],
  ["2009-12-06T00:00:00Z", "week", 7],
  ["2009-12-01T00:00:00Z", "month", 7],
  ["2008-10-01T00:00:00Z", "quarter", 7],
  ["2007-01-01T00:00:00Z", "year", 7],
  ["2010-01-01T10:45:20.448Z", "millisecond", 13],
  ["2010-01-01T10:45:14Z", "second", 13],
  ["2010-01-01T10:37:00Z", "minute", 13],
  ["2010-01-01T00:00:00Z", "hour", 13],
  ["2010-01-01T00:00:00Z", "day", 13],
  ["2009-12-20T00:00:00Z", "week", 13],
  ["2009-10-01T00:00:00Z", "month", 13],
  ["2009-10-01T00:00:00Z", "quarter", 13],
  ["2000-01-01T00:00:00Z", "year", 13]
] as const;

runTest(testPath(__filename), {
  $dateTrunc: fixtures.map(([result, unit, binSize, timezone, startOfWeek]) => [
    {
      date: new Date("2010-01-01T10:45:20.450Z"),
      unit,
      binSize,
      timezone,
      startOfWeek
    },
    new Date(result)
  ])
});
