# slidemachina benchmark

13 November 2026. The same talk of 21 slides in the slidemachina of this commit and the latest reveal.js, Slidev and open-slide from npm, median of 5 runs.
The method is in [benchmark/](https://github.com/xfenix/slidemachina/tree/main/benchmark) of the main branch.

![The benchmark](benchmark.svg)

| | slidemachina 1.5.0 | reveal.js 6.0.2 | Slidev 53.1.0 | open-slide 2.3.2 |
|---|---|---|---|---|
| First slide on screen | 140 ms | 181 ms | 287 ms | 303 ms |
| Key press to screen update | 26 ms | 17 ms | 26 ms | 29 ms |
| Dev server to first slide | 1.00 s | 0.60 s | 4.35 s | 3.03 s |
| Production build | 0.70 s | 0.39 s | 3.05 s | 1.25 s |
| Build output size | 0.7 MB | 1.8 MB | 0.9 MB | 1.9 MB |
| PDF export | 1.4 s | 23.3 s | 4.8 s | — |
