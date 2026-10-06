import { AuthProvider } from "@/components/auth-provider";
import EmailAction from "@/components/email-action";
export const metadata = {
  title: "Akun kamu — D’Fable",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const scope = p.scope === "admin" ? "admin" : "customer";
  return (
    <AuthProvider key={scope} scope={scope}>
      <EmailAction />
    </AuthProvider>
  );
}
