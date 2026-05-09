import { redirect } from "next/navigation";

import { verifyMagicLink } from "../actions";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/auth/login");
  await verifyMagicLink(token);
  return null;
}
