# slidemachina benchmark

30 October 2026. The same talk of 21 slides in the latest versions from npm, median of 5 runs.
The method is in [benchmark/](https://github.com/xfenix/slidemachina/tree/main/benchmark) of the main branch.

![The benchmark](benchmark.svg)

| | slidemachina 1.2.0 | reveal.js 6.0.2 | Slidev 53.0.0 | open-slide 2.3.1 |
|---|---|---|---|---|
| First slide on screen | 243 ms | 207 ms | 267 ms | 301 ms |
| JavaScript sent, gzip | 558 KB | 348 KB | 221 KB | 462 KB |
| Memory after load | 4.7 MB | 7.7 MB | 5.1 MB | 8.1 MB |
| Dev server to first slide | 1.58 s | 0.61 s | 3.78 s | 2.96 s |
| Production build | 1.00 s | 0.38 s | 2.85 s | 1.17 s |
| node_modules | 197 MB | 40 MB | 467 MB | 208 MB |
