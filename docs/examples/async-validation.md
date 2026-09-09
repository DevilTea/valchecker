# Async Validation

This legacy route is retained temporarily for compatibility while the final route cleanup is handled by #154.

Use:

- [Async Validation](/guides-recipes/async-validation) for database/API/service-check application patterns;
- [Synchronous and Asynchronous Execution](/core-concepts/sync-and-async) for direct, maybe-async, and forced-async execution semantics;
- [`check()` Reference](/api/helpers#check) for the exact callback contract;
- [`toAsync()` Reference](/api/helpers#toasync) when every invocation must return a native promise.

The old page mixed application recipes with execution-model theory; those concerns now have separate canonical owners.
