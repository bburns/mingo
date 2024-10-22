import { AnyObject } from "../../../src/types";
import * as samples from "../../support";

const things: AnyObject[] = [];
for (let i = 0; i < 100; i++) {
  things.push({ _id: i });
}

samples.runTestPipeline("operators/pipeline/bucketAuto", [
  {
    message: "can apply $bucketAuto operator",
    input: [
      {
        _id: 1,
        title: "The Pillars of Society",
        artist: "Grosz",
        year: 1926,
        price: 199.99,
        dimensions: { height: 39, width: 21, units: "in" }
      },
      {
        _id: 2,
        title: "Melancholy III",
        artist: "Munch",
        year: 1902,
        price: 280.0,
        dimensions: { height: 49, width: 32, units: "in" }
      },
      {
        _id: 3,
        title: "Dancer",
        artist: "Miro",
        year: 1925,
        price: 76.04,
        dimensions: { height: 25, width: 20, units: "in" }
      },
      {
        _id: 4,
        title: "The Great Wave off Kanagawa",
        artist: "Hokusai",
        price: 167.3,
        dimensions: { height: 24, width: 36, units: "in" }
      },
      {
        _id: 5,
        title: "The Persistence of Memory",
        artist: "Dali",
        year: 1931,
        price: 483.0,
        dimensions: { height: 20, width: 24, units: "in" }
      },
      {
        _id: 6,
        title: "Composition VII",
        artist: "Kandinsky",
        year: 1913,
        price: 385.0,
        dimensions: { height: 30, width: 46, units: "in" }
      },
      {
        _id: 7,
        title: "The Scream",
        artist: "Munch",
        price: 159.0,
        dimensions: { height: 24, width: 18, units: "in" }
      },
      {
        _id: 8,
        title: "Blue Flower",
        artist: "O'Keefe",
        year: 1918,
        price: 118.42,
        dimensions: { height: 24, width: 20, units: "in" }
      }
    ],

    pipeline: [
      {
        $bucketAuto: {
          groupBy: "$price",
          buckets: 4
        }
      }
    ],

    expected: [
      { _id: { min: 76.04, max: 159 }, count: 2 },
      { _id: { min: 159, max: 199.99 }, count: 2 },
      { _id: { min: 199.99, max: 385 }, count: 2 },
      { _id: { min: 385, max: 483 }, count: 2 }
    ]
  },

  {
    message: "can apply $bucketAuto with nil granularity",
    input: things,
    pipeline: [
      {
        $bucketAuto: {
          groupBy: "$_id",
          buckets: 5
        }
      }
    ],

    expected: [
      { _id: { min: 0, max: 20 }, count: 20 },
      { _id: { min: 20, max: 40 }, count: 20 },
      { _id: { min: 40, max: 60 }, count: 20 },
      { _id: { min: 60, max: 80 }, count: 20 },
      { _id: { min: 80, max: 99 }, count: 20 }
    ]
  }
]);
