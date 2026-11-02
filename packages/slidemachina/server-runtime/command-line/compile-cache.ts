// The first import of the CLI: a warm on-disk compile cache turns the next starts of dev and build
// from ~0.16 s of module compilation into ~0.02 s. A side-effect module, so the call runs before the other imports evaluate.
import { enableCompileCache } from "node:module";

enableCompileCache();
