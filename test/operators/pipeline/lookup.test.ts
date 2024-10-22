import * as samples from "../../support";

const orders = [
  { _id: 1, item: { name: "abc" }, price: 12, quantity: 2 },
  { _id: 2, item: { name: "jkl" }, price: 20, quantity: 1 },
  { _id: 3 }
];

const inventory = [
  { _id: 1, sku: "abc", description: "product 1", instock: 120 },
  { _id: 2, sku: "def", description: "product 2", instock: 80 },
  { _id: 3, sku: "ijk", description: "product 3", instock: 60 },
  { _id: 4, sku: "jkl", description: "product 4", instock: 70 },
  { _id: 5, sku: null, description: "Incomplete" },
  { _id: 6 }
];

const members = [
  {
    _id: 1,
    name: ["giraffe22", "pandabear", "artie"],
    joined: new Date("2016-05-01"),
    status: "A"
  },
  {
    _id: 2,
    name: "giraffe",
    joined: new Date("2017-05-01"),
    status: "D"
  },
  {
    _id: 3,
    name: "giraffe1",
    joined: new Date("2017-10-01"),
    status: "A"
  },
  {
    _id: 4,
    name: "panda",
    joined: new Date("2018-10-11"),
    status: "A"
  },
  {
    _id: 5,
    name: "pandabear",
    joined: new Date("2018-12-01"),
    status: "A"
  },
  {
    _id: 6,
    name: "giraffe2",
    joined: new Date("2018-12-01"),
    status: "D"
  }
];

samples.runTestPipeline("operators/pipeline/lookup", [
  {
    message: "Perform a Single Equality Join",
    input: orders,
    pipeline: [
      {
        $lookup: {
          from: inventory,
          localField: "item.name",
          foreignField: "sku",
          as: "inventory_docs"
        }
      }
    ],
    expected: [
      {
        _id: 1,
        item: { name: "abc" },
        price: 12,
        quantity: 2,
        inventory_docs: [
          { _id: 1, sku: "abc", description: "product 1", instock: 120 }
        ]
      },
      {
        _id: 2,
        item: { name: "jkl" },
        price: 20,
        quantity: 1,
        inventory_docs: [
          { _id: 4, sku: "jkl", description: "product 4", instock: 70 }
        ]
      },
      {
        _id: 3,
        inventory_docs: [
          { _id: 5, sku: null, description: "Incomplete" },
          { _id: 6 }
        ]
      }
    ]
  },
  {
    message: "Use $lookup with an Array",
    input: [
      {
        _id: 1,
        title: "Reading is ...",
        enrollmentlist: ["giraffe2", "pandabear", "artie"],
        days: ["M", "W", "F"]
      },
      {
        _id: 2,
        title: "But Writing ...",
        enrollmentlist: ["giraffe1", "artie"],
        days: ["T", "F"]
      }
    ],
    pipeline: [
      {
        $lookup: {
          from: members,
          localField: "enrollmentlist",
          foreignField: "name",
          as: "enrollee_info"
        }
      },
      {
        // ensuring test stability
        $addFields: {
          enrollee_info: {
            $sortArray: {
              input: "$enrollee_info",
              sortBy: { _id: 1 }
            }
          }
        }
      }
    ],
    expected: [
      {
        _id: 1,
        title: "Reading is ...",
        enrollmentlist: ["giraffe2", "pandabear", "artie"],
        days: ["M", "W", "F"],
        enrollee_info: [
          {
            _id: 1,
            name: ["giraffe22", "pandabear", "artie"],
            joined: new Date("2016-05-01T00:00:00Z"),
            status: "A"
          },
          {
            _id: 5,
            name: "pandabear",
            joined: new Date("2018-12-01T00:00:00Z"),
            status: "A"
          },
          {
            _id: 6,
            name: "giraffe2",
            joined: new Date("2018-12-01T00:00:00Z"),
            status: "D"
          }
        ]
      },
      {
        _id: 2,
        title: "But Writing ...",
        enrollmentlist: ["giraffe1", "artie"],
        days: ["T", "F"],
        enrollee_info: [
          {
            _id: 1,
            name: ["giraffe22", "pandabear", "artie"],
            joined: new Date("2016-05-01T00:00:00Z"),
            status: "A"
          },
          {
            _id: 3,
            name: "giraffe1",
            joined: new Date("2017-10-01T00:00:00Z"),
            status: "A"
          }
        ]
      }
    ]
  }
]);
