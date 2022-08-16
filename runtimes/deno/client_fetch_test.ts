import { assert } from "https://deno.land/std@0.152.0/testing/asserts.ts";

const projectId = "81pocpw8";
const dataset = "production";
const query = /* groq */ `count(*[studioVersion == 3])`;

// Ensure the runtime is supposed to be able to run this query correctly
Deno.test("native fetch", async () => {
  const res = await fetch(
    `https://${projectId}.apicdn.sanity.io/v1/data/query/${dataset}?query=${
      encodeURIComponent(
        query,
      )
    }`,
  );
  const { result: data } = await res.json();
  assert(Number.isInteger(data));
});
