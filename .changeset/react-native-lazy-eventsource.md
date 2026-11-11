---
'@sanity/client': patch
---

Importing the client no longer throws `ReferenceError: Event is not defined` in runtimes without the `Event` and `EventTarget` globals, such as React Native before 0.86. The `eventsource` package is now loaded the first time a listener or live connection opens, so only those connections need the globals.
