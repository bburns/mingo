import { AnyObject } from "../../../src/types";
import { aggregate, testPath } from "../../support";

describe(testPath(__filename), () => {
  const things: AnyObject[] = [];
  for (let i = 0; i < 100; i++) things.push({ _id: i });

  const artwork = [
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
  ];

  it("Single Facet Aggregation", () => {
    const result = aggregate(artwork, [
      {
        $bucketAuto: {
          groupBy: "$price",
          buckets: 4
        }
      }
    ]);

    expect(result).toEqual([
      { _id: { min: 76.04, max: 159 }, count: 2 },
      { _id: { min: 159, max: 199.99 }, count: 2 },
      { _id: { min: 199.99, max: 385 }, count: 2 },
      { _id: { min: 385, max: 483 }, count: 2 }
    ]);
  });

  it("Multi-Faceted Aggregation", () => {
    const result = aggregate(artwork, [
      {
        $facet: {
          price: [
            {
              $bucketAuto: {
                groupBy: "$price",
                buckets: 4
              }
            }
          ],
          year: [
            {
              $bucketAuto: {
                groupBy: "$year",
                buckets: 3,
                output: {
                  count: { $sum: 1 },
                  years: { $push: "$year" }
                }
              }
            }
          ],
          area: [
            {
              $bucketAuto: {
                groupBy: {
                  $multiply: ["$dimensions.height", "$dimensions.width"]
                },
                buckets: 4,
                output: {
                  count: { $sum: 1 },
                  titles: { $push: "$title" }
                }
              }
            }
          ]
        }
      }
    ]);

    expect(result).toEqual([
      {
        area: [
          {
            _id: { min: 432, max: 500 },
            count: 3,
            titles: ["The Scream", "The Persistence of Memory", "Blue Flower"]
          },
          {
            _id: { min: 500, max: 864 },
            count: 2,
            titles: ["Dancer", "The Pillars of Society"]
          },
          {
            _id: { min: 864, max: 1568 },
            count: 2,
            titles: ["The Great Wave off Kanagawa", "Composition VII"]
          },
          {
            _id: { min: 1568, max: 1568 },
            count: 1,
            titles: ["Melancholy III"]
          }
        ],
        price: [
          {
            _id: { min: 76.04, max: 159.0 },
            count: 2
          },
          {
            _id: { min: 159.0, max: 199.99 },
            count: 2
          },
          {
            _id: { min: 199.99, max: 385.0 },
            count: 2
          },
          {
            _id: { min: 385.0, max: 483.0 },
            count: 2
          }
        ],
        year: [
          { _id: { min: null, max: 1913 }, count: 3, years: [1902] },
          {
            _id: { min: 1913, max: 1926 },
            count: 3,
            years: [1913, 1918, 1925]
          },
          { _id: { min: 1926, max: 1931 }, count: 2, years: [1926, 1931] }
        ]
      }
    ]);
  });

  it("Equal Parititons without Granularity", () => {
    const result = aggregate(things, [
      {
        $bucketAuto: {
          groupBy: "$_id",
          buckets: 5
        }
      }
    ]);
    expect(result).toEqual([
      { _id: { min: 0, max: 20 }, count: 20 },
      { _id: { min: 20, max: 40 }, count: 20 },
      { _id: { min: 40, max: 60 }, count: 20 },
      { _id: { min: 60, max: 80 }, count: 20 },
      { _id: { min: 80, max: 99 }, count: 20 }
    ]);
  });
});
