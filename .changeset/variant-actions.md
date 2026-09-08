---
'@sanity/client': minor
---

feat: add variant actions

Adds `CreateVariantAction`, `EditVariantAction`, `DeleteVariantAction`, `PublishVariantAction` and
`UnpublishVariantAction`, along with a `VariantAction` union, covering the
`sanity.action.document.variant.*` actions. They are included in the `Action` union, so
`client.action()` accepts them.

Each action addresses a variant document by the `publishedId`, `variantId` and `bundleId` triple
rather than by document ID, since the API derives the document ID from those three values.

Note that `Action` widening is a breaking change for code that exhaustively switches on
`Action['actionType']` with a `never` fallthrough, which will need to handle the new cases.
