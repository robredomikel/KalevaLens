import { processMediaJobs, reconcileMediaJobs } from "@/lib/media/jobs";

export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.MEDIA_JOB_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  if (url.searchParams.get("reconcile") === "true") await reconcileMediaJobs((process.env.MEDIA_LANGUAGES || "en").split(",").map((v) => v.trim()).filter(Boolean));
  return Response.json(await processMediaJobs());
}
