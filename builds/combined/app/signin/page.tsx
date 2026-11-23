import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";
import { safeReturnPath } from "@/lib/guards";

export const metadata: Metadata = {
  title: "Sign In",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const [user, params] = await Promise.all([getCurrentUser().catch(() => null), searchParams]);
  const returnTo = safeReturnPath(params.returnTo, "/");
  if (user) redirect(returnTo);

  return <AuthForm mode="signin" errorCode={params.error} returnTo={returnTo} />;
}
