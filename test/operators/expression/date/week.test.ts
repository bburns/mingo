import { runTest, testPath } from "../../../support";

const fixtures: [number | null, string, string?][] = [
  // [<Results>, <Args>,...]
  // [<result>, date, ?timezone]
  [0, "Jan 1, 2016"],
  [1, "2016-01-04"],
  [33, "August 14, 2011", "America/Chicago"]
  // FIXME: these tests are failing
  // [44, "1998-11-07T00:00:00Z"],
  // [43, "1998-11-07T00:00:00Z", "-0500"]
] as const;

runTest(testPath(__filename), {
  $week: fixtures.map(([result, date, timezone]) => [
    {
      date: new Date(date),
      timezone
    },
    result
  ])
});
