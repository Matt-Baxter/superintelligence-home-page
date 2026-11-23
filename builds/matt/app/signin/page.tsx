import { AuthForm } from "../AuthForm";

export const metadata = { title: "Sign in · Superintelligence Homepage" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthForm mode="signin" error={error} />;
}
