import { AuthProvider } from "@/components/auth-provider";
import Studio from "@/components/studio";
export default function Page() {
  return (
    <AuthProvider key="customer" scope="customer">
      <Studio />
    </AuthProvider>
  );
}
