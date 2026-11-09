# slidemachina benchmark

9 November 2026. The same talk of 21 slides in the slidemachina of this commit and the latest reveal.js, Slidev and open-slide from npm, median of 5 runs.
The method is in [benchmark/](https://github.com/xfenix/slidemachina/tree/main/benchmark) of the main branch.

![The benchmark](benchmark.svg)

| | slidemachina 1.5.0 | reveal.js 6.0.2 | Slidev 53.1.0 | open-slide 2.3.2 |
|---|---|---|---|---|
| First slide on screen | 178 ms | 249 ms | 310 ms | 435 ms |
| Key press to screen update | 30 ms | 18 ms | 26 ms | 33 ms |
| Dev server to first slide | 1.29 s | 0.66 s | 5.09 s | 3.76 s |
| Production build | 0.80 s | 0.47 s | 3.72 s | 1.50 s |
| Build output size | 0.7 MB | 1.8 MB | 0.9 MB | 1.9 MB |
| PDF export | 1.6 s | 23.5 s | 5.3 s | — |
