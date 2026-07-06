import { redirect } from "next/navigation";

import { Sidebar } from "@/components/dashboard/Sidebar";
import { ApiError, api } from "@/lib/api";
import type { RoleResponse, UserOut } from "@/lib/api-types";
import { getToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getToken();
  if (!token) redirect("/auth/login");

  // Fetch role + identity in parallel; surface a clean redirect if the
  // session has expired or the API rejects the JWT.
  let role: RoleResponse;
  let me: UserOut;
  try {
    [role, me] = await Promise.all([
      api.get<RoleResponse>("/v1/me/role"),
      api.get<UserOut>("/v1/me"),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      // Layouts render — they can't clear cookies. /auth/expired does.
      redirect("/auth/expired");
    }
    throw e;
  }

  return (
    <div className="grid min-h-svh w-full grid-rows-[auto_1fr] md:grid-cols-[16rem_1fr] md:grid-rows-1">
      <Sidebar role={role} email={me.email} />
      <div className="px-6 py-8 md:px-10 md:py-10">{children}</div>
    </div>
  );
}
