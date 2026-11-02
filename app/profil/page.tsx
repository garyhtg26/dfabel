import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import CustomerProfile from "@/components/profile-customer";

export const metadata: Metadata = {
  title: "Profil Saya — D’Fable Laundry",
};

export default function ProfilePage() {
  return (
    <AuthProvider scope="customer">
      <CustomerProfile />
    </AuthProvider>
  );
}
