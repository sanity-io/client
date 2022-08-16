// @TODO replace with a local path once we start exporting ESM
// import createClient from '../../dist/sanityClient.browser.mjs'
// @deno-types="../../sanityClient.d.ts"
import createClient from "https://esm.sh/@sanity/client";
export { createClient };
