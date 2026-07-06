import { NextRequest, NextResponse } from "next/server";

import { clearToken } from "@/lib/session";

// Landing for dead sessions. Render code can't clear cookies (route handlers
// and server actions only), so pages redirect here when the API rejects the
// JWT, and this clears the cookie before bouncing to login.
export async function GET(req: NextRequest) {
  await clearToken();
  return NextResponse.redirect(new URL("/auth/login?error=session-expired", req.url));
}
