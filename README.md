# slidemachina benchmark

7 November 2026. The same talk of 21 slides in the slidemachina of this commit and the latest reveal.js, Slidev and open-slide from npm, median of 5 runs.
The method is in [benchmark/](https://github.com/xfenix/slidemachina/tree/main/benchmark) of the main branch.

![The benchmark](benchmark.svg)

| | slidemachina 1.5.0 | reveal.js 6.0.2 | Slidev 53.1.0 | open-slide 2.3.1 |
|---|---|---|---|---|
| First slide on screen | 141 ms | 197 ms | 290 ms | 333 ms |
| Key press to screen update | 28 ms | 16 ms | 26 ms | 29 ms |
| Dev server to first slide | 1.02 s | 0.60 s | 3.91 s | 2.98 s |
| Production build | 0.66 s | 0.38 s | 2.90 s | 1.17 s |
| Build output size | 0.7 MB | 1.8 MB | 0.9 MB | 1.9 MB |
| PDF export | 1.3 s | 23.1 s | 4.7 s | — |
