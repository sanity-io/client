---
'@sanity/client': patch
---

Importing the client no longer throws `ReferenceError: Event is not defined` in runtimes without the `Event` and `EventTarget` globals, such as React Native on Hermes. The `eventsource` package is now loaded the first time `listen()` or `live.events()` connects.
