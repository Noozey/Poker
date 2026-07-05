import type { Env } from "../types";
import { getSupabase } from "../database/supabaseConfig";

interface BulkUserRequestBody {
  userIds: string[];
}

export async function handleAuth(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  if (request.method === "POST" && url.pathname === "/auth/user/bulk") {
    const { userIds } = (await request.json()) as BulkUserRequestBody;

    if (!Array.isArray(userIds)) {
      return Response.json({ error: "userIds must be an array" }, { status: 400 });
    }

    try {
      const { data, error } = await getSupabase(env)
        .from("auth.users")
        .select("*")
        .in("id", userIds);

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json(data);
    } catch (err) {
      return Response.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  return new Response("Not found", { status: 404 });
}
