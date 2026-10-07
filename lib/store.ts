import "server-only";
import type { BranchId } from "./branches";
import { db, firebaseReady } from "./firebase/admin";
import { siteContent } from "./site-content";
import { defaultStore } from "./defaults";
import type { Identity } from "./firebase/access";
import type { Order, Store } from "./types";
export async function readStore(
  user: Identity | null,
  branch: BranchId = "cinere",
): Promise<Store> {
  if (!firebaseReady())
    return { ...defaultStore, configured: false, isAdmin: false };
  const database = db();
  const settings = await database.doc(`settings/${branch}`).get();
  const data = settings.exists ? settings.data()! : defaultStore;
  let orders: Order[] = [];
  let hasMore = false;
  let profile = { name: user?.name || "", phone: "", email: user?.email || "" };
  if (user) {
    const q = user.admin
      ? database.collection("orders").where("branchId", "==", branch)
      : database
          .collection("orders")
          .where("uid", "==", user.uid)
          .orderBy("createdAt", "desc");
    const [snap, p] = await Promise.all([
      user.admin ? q.get() : q.limit(501).get(),
      database.doc(`users/${user.uid}`).get(),
    ]);
    hasMore = snap.size > 500;
    orders = [...snap.docs]
      .sort((a, b) =>
        String(b.get("createdAt")).localeCompare(String(a.get("createdAt"))),
      )
      .slice(0, 500)
      .map((d) => {
        const o = d.data() as Order;
        const { photoPath, ...rest } = o;
        return { ...rest, photo: photoPath ? `/api/orders/${o.id}/photo` : "" };
      });
    if (p.exists)
      profile = {
        name: p.get("name") || profile.name,
        phone: p.get("phone") || "",
        email: profile.email,
      };
  }
  return {
    branchId: branch,
    services: data.services || defaultStore.services,
    content: siteContent(data.content),
    promo: data.promo || defaultStore.promo,
    orders,
    configured: true,
    isAdmin: !!user?.admin,
    canManageUsers: !!user?.manageUsers,
    role: user?.role || "customer",
    profile,
    hasMore,
  };
}
