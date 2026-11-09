# slidemachina benchmark

9 November 2026. The same talk of 21 slides in the slidemachina of this commit and the latest reveal.js, Slidev and open-slide from npm, median of 5 runs.
The method is in [benchmark/](https://github.com/xfenix/slidemachina/tree/main/benchmark) of the main branch.

![The benchmark](benchmark.svg)

| | slidemachina 1.5.0 | reveal.js 6.0.2 | Slidev 53.1.0 | open-slide 2.3.2 |
|---|---|---|---|---|
| First slide on screen | 194 ms | 255 ms | 347 ms | 467 ms |
| Key press to screen update | 27 ms | 21 ms | 29 ms | 34 ms |
| Dev server to first slide | 1.20 s | 0.65 s | 4.61 s | 3.60 s |
| Production build | 0.76 s | 0.46 s | 3.39 s | 1.48 s |
| Build output size | 0.7 MB | 1.8 MB | 0.9 MB | 1.9 MB |
| PDF export | 1.5 s | 23.4 s | 5.2 s | — |
