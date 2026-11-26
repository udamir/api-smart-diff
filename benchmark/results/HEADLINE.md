# api-smart-diff benchmark: 1.0.6 vs 2.0.0 headline

The table of the Performance section of the documentation, re-measured by `npm run headline` ([README](../README.md)): the published api-smart-diff 1.0.6 package against the repository build, one fresh process per cell, 20 warm-up calls (fewer when they would exceed 60 s), minimum of 7 to 11 timed calls, documents parsed outside the timing. The full comparison with the other tools is in the [overview](README.md).

The published api-smart-diff 1.0.6 package vs the repository build of 2.0.0 (commit 21d2d22, the 2.0.0 release plus documentation commits); measured 2026-11-26, Node.js v26.13.0, Intel(R) Core(TM) i9-9880H CPU @ 2.30GHz, 16 GB, macOS 15; load average (1 / 5 / 15 min) 4.8 / 6.1 / 7.9 before and 6.3 / 6.8 / 7.8 after the run (other sessions were running). Minimum of the timed calls.

| Input | 1.0.6 | 2.0.0 |
| --- | --- | --- |
| GitHub REST API description (7.6 MB JSON, 1 281 operations), 21 changes | 10.0 s | 0.12 s |
| GitHub public GraphQL schema (1.1 MB SDL), 18 changes | not finished after 60 s | 55 ms |
| OpenAPI petstore, 24 changes | 34 ms | 2.7 ms |
| A schema with 10 000 properties | 0.71 s | 17 ms |
| A schema with 1 500 properties, in a request | 0.11 s | 1.9 ms |
| A schema with 1 500 properties, in a response | 0.62 s | 1.8 ms |
| AsyncAPI 2.6 event API (3 KB), 12 changes | 1.0 ms | 1.1 ms |
