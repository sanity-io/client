// @TODO replace with a local path once we start exporting ESM
// import createClient from '../../dist/sanityClient.browser.mjs'
import createClient from "https://esm.sh/@sanity/client";
// @ts-expect-error
export { createClient };
