import * as support from "../../../support";

support.runTest(support.testPath(__filename), {
  $isArray: [
    [[], false, { err: true }],
    [[1, 2], false, { err: true }],
    [["hello"], false],
    [[[]], true],
    [[["hello"]], true],
    ["bad", false],
    ["$arr", true, { obj: { arr: [] } }],
    [["$arr"], true, { obj: { arr: [] } }],
    [["$arr"], false, { obj: { arr: 1 } }]
  ]
});
