"use server";

import { revalidatePath } from "next/cache";
import { isAdminEmail } from "@/lib/admin";
import { isRunnableJob, runJob } from "@/lib/jobs/run";
import { createClient } from "@/lib/supabase/server";

/** Run a poll on demand from the admin UI. Re-checks admin server-side. */
export async function triggerPoll(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) return;

  const job = String(formData.get("job") ?? "");
  if (!isRunnableJob(job)) return;

  await runJob(job);
  revalidatePath("/admin");
  revalidatePath("/");
}
