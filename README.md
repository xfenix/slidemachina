# slidemachina benchmark

7 November 2026. The same talk of 21 slides in the slidemachina of this commit and the latest reveal.js, Slidev and open-slide from npm, median of 5 runs.
The method is in [benchmark/](https://github.com/xfenix/slidemachina/tree/main/benchmark) of the main branch.

![The benchmark](benchmark.svg)

| | slidemachina 1.5.0 | reveal.js 6.0.2 | Slidev 53.1.0 | open-slide 2.3.1 |
|---|---|---|---|---|
| First slide on screen | 154 ms | 186 ms | 321 ms | 292 ms |
| Key press to screen update | 25 ms | 15 ms | 26 ms | 27 ms |
| Dev server to first slide | 0.88 s | 0.55 s | 3.66 s | 2.75 s |
| Production build | 0.55 s | 0.34 s | 2.68 s | 1.09 s |
| Build output size | 0.7 MB | 1.8 MB | 0.9 MB | 1.9 MB |
| PDF export | 1.3 s | 23.0 s | 4.1 s | — |
