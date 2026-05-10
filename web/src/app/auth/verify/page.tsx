import { redirect } from "next/navigation";

import { getToken } from "@/lib/session";

import { verifyMagicLink } from "../actions";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/auth/login");
  // If a session is already set (e.g. RSC re-render after first call
  // succeeded), skip the verify call — it would 401 because the token
  // is single-use.
  if (await getToken()) redirect("/dashboard");
  await verifyMagicLink(token);
  return null;
}
