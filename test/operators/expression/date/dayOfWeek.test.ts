import { runTest, testPath } from "../../../support";

const fixtures: [number | null, string, string?][] = [
  // [<Results>, <Args>,...]
  // [<result>, date, ?timezone]
  [6, "2016-01-01"],
  [3, "Jan 7, 2003"],
  [1, "August 14, 2011", "America/Chicago"],
  [7, "1998-11-07T00:00:00Z"],
  [6, "1998-11-07T00:00:00Z", "-0400"]
] as const;

runTest(testPath(__filename), {
  $dayOfWeek: fixtures.map(([result, date, timezone]) => [
    {
      date: new Date(date),
      timezone
    },
    result
  ])
});
