import { AuthForm } from "../AuthForm";

export const metadata = { title: "Sign up · Superintelligence Homepage" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthForm mode="signup" error={error} />;
}
