import { AuthProvider } from "@/components/auth-provider";
import Studio from "@/components/studio";
export default function Page() {
  return (
    <AuthProvider key="admin" scope="admin">
      <Studio dashboard />
    </AuthProvider>
  );
}
