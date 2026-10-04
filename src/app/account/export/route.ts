import { exportUserData } from "@/lib/auth/accounts";
import { currentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

/** Downloads everything NextScore stores about the signed-in student, as JSON. */
export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Sign in to download your data.", { status: 401 });
  const data = await exportUserData(await getDb(), user.id);
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nextscore-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
