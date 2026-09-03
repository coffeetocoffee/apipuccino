/**
 * Apipuccino Sentinel — shared constants.
 * Laws: FREE (zero deps), OFFLINE-FIRST, HISTORY != GIT.
 */
export const UA = "ApipuccinoSentinel/1.0 (+https://github.com/coffeetocoffee/apipuccino)";
export const DEFAULT_TIMEOUT_MS = 8000;
export const DEATH_THRESHOLD = 3; // consecutive failed checks => DEATH event (same as directory)
export const SLOW_MS = 5000; // latency above this => Evolving ("slow")
export const MAX_CACHE_BYTES = 256 * 1024; // never bloat the repo with huge bodies

export const SENTINEL_DIR = ".sentinel";
export const CONFIG_FILE = "config.json";
export const RESULTS_FILE = "results.json";
export const REPORT_FILE = "last-report.json";
export const HISTORY_DIR = "history";
export const CACHE_DIR = "cache";
