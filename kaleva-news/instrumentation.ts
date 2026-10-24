declare global {
  var __kalevaDemoMediaWorkerStarted: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.MEDIA_AUTO_PROCESS_ON_START !== "true" || globalThis.__kalevaDemoMediaWorkerStarted) return;
  globalThis.__kalevaDemoMediaWorkerStarted = true;
  const intervalMs = Math.max(5000, Number(process.env.MEDIA_WORKER_INTERVAL_MS || 15000));
  let cycles = 0;
  let running = false;

  const run = async (reconcile = false) => {
    if (running) return;
    running = true;
    try {
      const { processMediaJobs, reconcileMediaJobs } = await import("@/lib/media/jobs");
      const { processArticlePreferenceJobs } = await import("@/lib/preferences/service");
      if (reconcile) await reconcileMediaJobs((process.env.MEDIA_LANGUAGES || "en").split(",").map((value) => value.trim()).filter(Boolean));
      await processMediaJobs();
      await processArticlePreferenceJobs();
    } catch (error) {
      console.error("[DEMO MEDIA WORKER] Processing failed:", error);
    } finally {
      running = false;
    }
  };

  void run(true);
  const timer = setInterval(() => {
    cycles += 1;
    // Periodic reconciliation makes the queue convergent: newly published,
    // interrupted, and retry-exhausted audio is eventually made eligible again.
    void run(cycles % 4 === 0);
  }, intervalMs);
  timer.unref();
}
