import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { optionsResponse, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return optionsResponse(req);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader?.replace("Bearer ", "").trim();
    if (token !== serviceKey) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().split("T")[0];

    const { data: toUpdate, error: fetchErr } = await supabase
      .from("invoices")
      .select("id")
      .lt("due_date", today)
      .neq("status", "paid")
      .neq("status", "cancelled");

    if (fetchErr) {
      console.error("Error fetching overdue invoices:", fetchErr);
      return jsonResponse(req, { error: "Failed to fetch invoices" }, 500);
    }

    const ids = (toUpdate ?? []).map((r) => r.id);
    if (ids.length === 0) {
      return jsonResponse(req, { message: "No invoices to mark overdue", updated: 0 });
    }

    const { error: updateErr } = await supabase
      .from("invoices")
      .update({ status: "overdue" })
      .in("id", ids);

    if (updateErr) {
      console.error("Error updating invoices:", updateErr);
      return jsonResponse(req, { error: "Failed to update invoices" }, 500);
    }

    return jsonResponse(req, { message: `Marked ${ids.length} invoices as overdue`, updated: ids.length });
  } catch (e) {
    console.error("check-overdue error:", e);
    return jsonResponse(req, { error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
