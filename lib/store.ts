import "server-only";
import { db, firebaseReady } from "./firebase/admin";
import { defaultStore } from "./defaults";
import type { Identity } from "./firebase/access";
import type { Order, Store } from "./types";
export async function readStore(user: Identity | null): Promise<Store> {
  if (!firebaseReady())
    return { ...defaultStore, configured: false, isAdmin: false };
  const database = db();
  const settings = await database.doc("settings/cinere").get();
  const data = settings.exists ? settings.data()! : defaultStore;
  let orders: Order[] = [];
  let hasMore = false;
  let profile = { name: user?.name || "", phone: "", email: user?.email || "" };
  if (user) {
    const q = user.admin
      ? database.collection("orders").orderBy("createdAt", "desc")
      : database
          .collection("orders")
          .where("uid", "==", user.uid)
          .orderBy("createdAt", "desc");
    const [snap, p] = await Promise.all([
      q.limit(501).get(),
      database.doc(`users/${user.uid}`).get(),
    ]);
    hasMore = snap.size > 500;
    orders = snap.docs.slice(0, 500).map((d) => {
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
    services: data.services,
    promo: data.promo,
    orders,
    configured: true,
    isAdmin: !!user?.admin,
    profile,
    hasMore,
  };
}
