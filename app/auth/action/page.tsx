import { AuthProvider } from "@/components/auth-provider";
import EmailAction from "@/components/email-action";
import { emailScope } from "@/lib/auth-ui";
export const metadata = {
  title: "Verifikasi akun — D’Fable",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const value = (key: string) =>
    typeof p[key] === "string" ? (p[key] as string) : undefined;
  const scope = emailScope({
    scope: value("scope"),
    continueUrl: value("continueUrl"),
  });
  return (
    <AuthProvider key={scope} scope={scope}>
      <EmailAction
        mode={value("mode") || "invalid"}
        code={value("oobCode") || ""}
      />
    </AuthProvider>
  );
}
