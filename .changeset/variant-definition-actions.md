---
'@sanity/client': minor
---

feat: add variant definition actions

Adds `CreateVariantDefinitionAction`, `EditVariantDefinitionAction` and
`DeleteVariantDefinitionAction`, along with a `VariantDefinitionAction` union, covering the
`sanity.action.variant.definition.*` actions. They are included in the `Action` union, so
`client.action()` accepts them.

Note that `Action` widening is a breaking change for code that exhaustively switches on
`Action['actionType']` with a `never` fallthrough, which will need to handle the new cases.
