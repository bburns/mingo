import { Query } from "../src/query";

describe("Mingo $all bug", () => {
  test("$all for 1 element should work (but does not)", () => {
    const doc = {
      nested: [
        {
          id: "123",
          name: "abc"
        }
      ]
    };

    const mingoQuery = new Query({
      "nested.id": {
        $all: ["123"]
      }
    });
    expect(mingoQuery.test(doc)).toBe(true); // expect true
  });

  test("$all for 2 elements should work (and does)", () => {
    const doc = {
      nested: [
        {
          id: "123",
          name: "abc"
        },
        {
          id: "456",
          name: "cde"
        }
      ]
    };

    const mingoQuery = new Query({
      "nested.id": {
        $all: ["123"]
      }
    });
    expect(mingoQuery.test(doc)).toBe(true); // works
  });
});
