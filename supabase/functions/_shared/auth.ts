import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { User } from "https://esm.sh/@supabase/supabase-js@2";

export async function getAuthenticatedUser(
  req: Request,
): Promise<{ user: User; token: string } | { error: string; status: number }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing or invalid Authorization header", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: "Unauthorized", status: 401 };
  }

  return { user, token };
}
