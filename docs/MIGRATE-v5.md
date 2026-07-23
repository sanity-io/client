# Migrating from `v5`

## The default `useCdn` is changed to `true`

It was previously `false`. If you were relying on the default being `false` you can continue using the live API by setting it in the constructor:

```diff
import {createClient} from '@sanity/client'

export const client = createClient({
  projectId: 'your-project-id',
  dataset: 'your-dataset-name',
  apiVersion: '2025-02-06',
+ useCdn: false, // set to `true` to use the edge cache
})
```
