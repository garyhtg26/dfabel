"use client";
import { useState, useEffect, useRef, type FormEvent } from "react";
import dynamic from "next/dynamic";
import CustomerHome from "./customer-home";
import { useAuth } from "./auth-provider";
import AccountPanel from "./account-panel";
import Tracking, { previewTracking } from "./tracking";
import AuthorizedPhoto from "./authorized-photo";
import type { TrackingOrder } from "@/lib/types";
import { calculatePrice } from "@/lib/pricing";
import {
  Shirt,
  WashingMachine,
  Wind,
  Package,
  MapPin,
  ChevronDown,
  Plus,
  Clock,
  Truck,
  Check,
  Search,
  X,
  Camera,
  CalendarDays,
  LayoutDashboard,
  ShoppingBag,
  Tags,
  Megaphone,
  LogOut,
  Menu,
  User,
  ReceiptText,
  Wallet,
  CheckCircle2,
  Copy,
  Info,
  Loader2,
  Minus,
  SlidersHorizontal,
  Headphones,
  Layers,
  ShieldCheck,
} from "lucide-react";
import {
  money,
  statuses,
  type Store,
  type Order,
  type Service,
} from "@/lib/types";
const MapPicker = dynamic(() => import("./map-picker"), {
  ssr: false,
  loading: () => <div className="map-loading">Memuat peta…</div>,
});
const icons = {
  shirt: Shirt,
  wash: WashingMachine,
  iron: Wind,
  member: Layers,
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    new Date(),
  );
function estimate(
  services: Service[],
  id: string,
  kg: number,
  express: boolean,
) {
  const s = services.find((v) => v.id === id);
  if (!s) return 0;
  const wash = services.find((v) => v.id === "wash")!.price;
  return calculatePrice(id, kg, s.price, wash, express);
}
function Brand() {
  return (
    <a className="brand" href="/" aria-label="D’Fable beranda">
      <img src="/dfable-logo.png" alt="D’Fable Laundry Studio" />
    </a>
  );
}
function Icon({ service, size = 25 }: { service: Service; size?: number }) {
  const C = icons[service.icon as keyof typeof icons] || Shirt;
  return <C size={size} strokeWidth={1.55} />;
}
export default function Studio({ dashboard = false }: { dashboard?: boolean }) {
  const auth = useAuth();
  const pendingOrder = useRef(false);
  const [publicOrder, setPublicOrder] = useState<TrackingOrder | null>(null);
  const [trackingError, setTrackingError] = useState("");
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("home");
  const [adminView, setAdminView] = useState("overview");
  const [modal, setModal] = useState("");
  const [service, setService] = useState("complete");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState({ name: "", phone: "" });
  const [track, setTrack] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  async function load() {
    try {
      const r = await auth.request("/api/store", { cache: "no-store" });
      if (!r.ok) throw Error("Data belum bisa dimuat");
      const data = await r.json();
      setStore(data);
      setProfile(
        data.profile || { name: auth.user?.displayName || "", phone: "" },
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
    const q = new URLSearchParams(location.search).get("track");
    if (q) {
      setTrack(q);
      setView("tracking");
    }
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [auth.user]);
  useEffect(() => {
    setPublicOrder(null);
    setTrackingError("");
    if (!/^[0-9a-f-]{36}$/i.test(track.trim())) return;
    const controller = new AbortController();
    const fetchTracking = async () => {
      try {
        const r = await fetch(
          `/api/tracking?token=${encodeURIComponent(track.trim())}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        setPublicOrder(data);
        setTrackingError("");
      } catch (e) {
        if (!controller.signal.aborted) setTrackingError((e as Error).message);
      }
    };
    fetchTracking();
    const timer = setInterval(fetchTracking, 15000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [track]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view, adminView]);
  useEffect(() => {
    if (modal) {
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [modal]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function action(action: string, data: unknown) {
    setBusy(true);
    try {
      const r = await auth.request("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      setStore(result.store);
      if (result.store.profile) setProfile(result.store.profile);
      return result;
    } finally {
      setBusy(false);
    }
  }
  function order(id = "complete") {
    setService(id);
    if (!auth.user) {
      pendingOrder.current = true;
      setModal("login");
      return;
    }
    setModal("order");
  }
  function notify(message: string) {
    setToast(message);
  }
  const orders = store?.orders || [];
  const myOrders = orders.filter((o) => auth.user && o.uid === auth.user.uid);
  const visible = orders.filter(
    (o) =>
      (filter === "all" || (filter === "active" ? o.status < 7 : !o.paid)) &&
      `${o.id} ${o.name} ${o.phone}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const tracked =
    publicOrder ||
    orders.find(
      (o) => o.token === track.trim() || o.id === track.trim().toUpperCase(),
    );
  if (!store)
    return (
      <main className="loading">
        <Brand />
        <p>{error || "Menyiapkan studio…"}</p>
        {error ? (
          <button className="primary" onClick={load}>
            Coba lagi
          </button>
        ) : (
          <Loader2 className="spin" />
        )}
      </main>
    );
  if (dashboard && store.configured && (!store.isAdmin || auth.loading))
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-10">
        <Brand />
        <AccountPanel admin phone={profile.phone} onDone={() => load()} />
        {auth.user && !store.isAdmin && (
          <p
            role="alert"
            className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800"
          >
            Akun ini belum mendapat akses admin toko.
          </p>
        )}
        <a href="/" className="text-sm text-indigo-600">
          Kembali ke web pelanggan
        </a>
      </main>
    );
  const revenue = orders.filter((o) => o.paid).reduce((a, o) => a + o.total, 0);
  return (
    <>
      <div className="demo-bar">
        {store.configured ? "D’FABLE CINERE" : "PREVIEW DESAIN"}{" "}
        <span>
          {store.configured
            ? "Laundry Studio · Jemput & antar"
            : "Firebase belum dihubungkan · Transaksi belum aktif"}
        </span>
        <a href={dashboard ? "/" : "/dashboard"}>
          {dashboard ? "Web pelanggan" : "Dashboard toko"}
        </a>
      </div>
      {dashboard ? (
        <div className="admin-shell">
          <aside className="sidebar">
            <Brand />
            <div className="branch-box">
              <span className="branch-icon">
                <MapPin size={18} />
              </span>
              <div>
                <b>Cabang Cinere</b>
                <small>Workspace toko</small>
              </div>
              <ChevronDown size={16} />
            </div>
            <span className="nav-caption">OPERASIONAL</span>
            {[
              ["overview", "Ringkasan", LayoutDashboard],
              ["orders", "Pesanan", ShoppingBag],
              ["pos", "Kasir / POS", ReceiptText],
              ["prices", "Layanan & harga", Tags],
              ["promo", "Promosi", Megaphone],
            ].map(([id, label, C]) => {
              const Component = C as typeof Shirt;
              return (
                <button
                  key={id as string}
                  className={
                    adminView === id ? "side-link active" : "side-link"
                  }
                  onClick={() => setAdminView(id as string)}
                >
                  <Component size={20} />
                  {label as string}
                  {id === "orders" && (
                    <span className="count">
                      {orders.filter((o) => o.status < 7).length}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="sidebar-bottom">
              <span className="avatar">DF</span>
              <div>
                <b>{auth.user?.displayName || "Preview admin"}</b>
                <small>D’Fable Cinere</small>
              </div>
              <a href="/" aria-label="Buka web pelanggan">
                <LogOut size={18} />
              </a>
            </div>
          </aside>
          <div className="admin-main">
            <header className="admin-top">
              <span>
                D’Fable Studio{" "}
                <span className="muted">
                  /{" "}
                  {
                    (
                      {
                        overview: "Ringkasan",
                        orders: "Pesanan",
                        pos: "Kasir",
                        prices: "Layanan & harga",
                        promo: "Promosi",
                      } as Record<string, string>
                    )[adminView]
                  }
                </span>
              </span>
              <span className="branch-pill">
                <MapPin size={14} /> Cinere
              </span>
            </header>
            <main className="admin-content">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">RUANG KERJA TOKO</p>
                  <h1>
                    {adminView === "overview"
                      ? "Semua dalam kendali."
                      : adminView === "orders"
                        ? "Kelola pesanan"
                        : adminView === "pos"
                          ? "Pesanan langsung, tetap terhubung."
                          : adminView === "prices"
                            ? "Layanan & harga"
                            : "Cerita baru di beranda."}
                  </h1>
                  <p className="muted">
                    {adminView === "overview"
                      ? "Pantau aktivitas laundry dan perkembangan tokomu."
                      : "Cabang Cinere · Kelola pesanan dan layanan."}
                  </p>
                </div>
                <button className="primary" onClick={() => order()}>
                  <Plus size={18} /> Pesanan baru
                </button>
              </div>
              {adminView === "overview" && (
                <>
                  <div className="metrics">
                    {[
                      [Wallet, "Penjualan terbayar", money(revenue)],
                      [ShoppingBag, "Total pesanan", orders.length],
                      [
                        WashingMachine,
                        "Dalam proses",
                        orders.filter((o) => o.status < 7).length,
                      ],
                      [
                        CheckCircle2,
                        "Pesanan selesai",
                        orders.filter((o) => o.status === 7).length,
                      ],
                    ].map(([C, label, value]) => {
                      const Component = C as typeof Shirt;
                      return (
                        <div className="metric" key={label as string}>
                          <span>
                            <Component size={19} />
                            {label as string}
                          </span>
                          <strong>{value as string | number}</strong>
                          <small>
                            {store.hasMore
                              ? "500 pesanan terbaru"
                              : "Seluruh pesanan"}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                  <div className="admin-two">
                    <section className="panel">
                      <div className="section-heading">
                        <h3>Alur operasional</h3>
                        <span className="muted">Pesanan aktif</span>
                      </div>
                      <div className="pipeline">
                        {[
                          "Menunggu",
                          "Penjemputan",
                          "Di studio",
                          "Pengantaran",
                        ].map((s, i) => {
                          const count = orders.filter((o) =>
                            i === 0
                              ? o.status === 0
                              : i === 1
                                ? [1, 2].includes(o.status)
                                : i === 2
                                  ? [3, 4, 5].includes(o.status)
                                  : o.status === 6,
                          ).length;
                          return (
                            <div key={s}>
                              <span className="pipeline-num">0{i + 1}</span>
                              <b>{count}</b>
                              <span>{s}</span>
                              <div className="bar">
                                <i
                                  style={{
                                    width: `${
                                      orders.length
                                        ? (count / orders.length) * 100
                                        : 0
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                    <section className="blue-note">
                      <Truck size={28} />
                      <h3>Setiap update berarti.</h3>
                      <p>
                        Status yang kamu ubah akan langsung terlihat di halaman
                        tracking pelanggan.
                      </p>
                      <button onClick={() => setAdminView("orders")}>
                        Kelola pesanan
                      </button>
                    </section>
                  </div>
                </>
              )}
              {(adminView === "overview" || adminView === "orders") && (
                <section className="panel orders-panel">
                  <div className="section-heading">
                    <h3>
                      {adminView === "overview"
                        ? "Pesanan terbaru"
                        : "Semua pesanan"}
                    </h3>
                    <span className="muted">{orders.length} pesanan</span>
                  </div>
                  <div className="table-tools">
                    <div className="tabs">
                      {[
                        ["all", "Semua"],
                        ["active", "Aktif"],
                        ["unpaid", "Belum dibayar"],
                      ].map(([v, t]) => (
                        <button
                          key={v}
                          className={filter === v ? "active" : ""}
                          onClick={() => setFilter(v)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <label className="search-box">
                      <Search size={17} />
                      <input
                        aria-label="Cari nama atau nomor pesanan"
                        placeholder="Cari nama / nomor pesanan"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Pesanan / pelanggan</th>
                          <th>Layanan</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th>Pembayaran</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {visible
                          .slice(0, adminView === "overview" ? 5 : 1000)
                          .map((o) => (
                            <tr key={o.id}>
                              <td>
                                <b>{o.name}</b>
                                <small>
                                  {o.id} ·{" "}
                                  {o.source === "pos" ? "Walk-in" : "Online"}
                                </small>
                              </td>
                              <td>
                                {
                                  store.services.find((s) => s.id === o.service)
                                    ?.name
                                }
                                <small>
                                  {o.actualKg ?? o.kg} kg ·{" "}
                                  {o.express ? "Express" : "Regular"}
                                </small>
                              </td>
                              <td>
                                <b>{money(o.total)}</b>
                              </td>
                              <td>
                                <span className="status">
                                  {statuses[o.status]}
                                </span>
                              </td>
                              <td>
                                <span className={o.paid ? "paid" : "unpaid"}>
                                  {o.paid ? "Lunas" : "Belum dibayar"}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="text-button"
                                  onClick={() => {
                                    setSelected(o);
                                    setModal("detail");
                                  }}
                                >
                                  Detail
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {!visible.length && (
                    <Empty
                      title="Belum ada pesanan"
                      text="Pesanan dari web pelanggan dan kasir akan muncul di sini."
                    />
                  )}
                </section>
              )}
              {adminView === "pos" && (
                <div className="pos-layout">
                  <section className="panel">
                    <p className="eyebrow">LAYANAN TOKO</p>
                    <h2>Pelanggan datang langsung?</h2>
                    <p className="muted">
                      Buat pesanan, catat berat aktual, lalu bagikan link
                      tracking.
                    </p>
                    <div className="service-grid pos-services">
                      {store.services
                        .filter((s) => s.id !== "member")
                        .map((s) => (
                          <button
                            className="service-card"
                            key={s.id}
                            onClick={() => order(s.id)}
                          >
                            <span className="service-icon">
                              <Icon service={s} />
                            </span>
                            <h3>{s.name}</h3>
                            <p>{s.description}</p>
                            <b>
                              {money(s.price)}
                              <small> / kg</small>
                            </b>
                            <span className="card-plus">
                              <Plus size={19} />
                            </span>
                          </button>
                        ))}
                    </div>
                  </section>
                  <div className="blue-note">
                    <ReceiptText size={32} />
                    <h2>
                      Satu pesanan.
                      <br />
                      Satu nomor tracking.
                    </h2>
                    <p>
                      Pelanggan pertama cukup memberikan nama dan nomor
                      WhatsApp. Tidak perlu membuat akun untuk melihat tracking
                      pesanan.
                    </p>
                  </div>
                </div>
              )}
              {adminView === "prices" && (
                <PriceEditor
                  store={store}
                  save={async (data) => {
                    await action("prices", data);
                    notify("Harga berhasil diperbarui");
                  }}
                />
              )}
              {adminView === "promo" && (
                <PromoEditor
                  store={store}
                  save={async (data) => {
                    await action("promo", data);
                    notify("Promosi berhasil diperbarui");
                  }}
                />
              )}
            </main>
          </div>
        </div>
      ) : (
        <>
          <header className="customer-header">
            <Brand />
            <nav>
              {[
                ["home", "Beranda"],
                ["services", "Layanan & harga"],
                ["tracking", "Lacak pesanan"],
              ].map(([v, t]) => (
                <button
                  className={view === v ? "active" : ""}
                  key={v}
                  onClick={() => setView(v)}
                >
                  {t}
                </button>
              ))}
            </nav>
            <div className="header-right">
              <button
                className="branch-pill"
                onClick={() =>
                  notify(
                    "Demo tersedia untuk cabang Cinere. Cabang lain dapat ditambahkan berikutnya.",
                  )
                }
              >
                <MapPin size={15} /> Cinere <ChevronDown size={13} />
              </button>
              <button
                className="account-button"
                aria-label="Buka profil pelanggan"
                onClick={() => setModal("login")}
              >
                <User size={18} />
                <span>{profile.name || "Masuk"}</span>
              </button>
            </div>
          </header>
          <main className="customer-main">
            {view === "home" && (
              <CustomerHome
                store={store}
                name={profile.name}
                onOrder={order}
                onMember={() => setModal("member")}
                onTrack={(code) => {
                  if (code) setTrack(code);
                  setView("tracking");
                }}
                onAccount={() => setModal("login")}
                onServices={() => setView("services")}
              />
            )}
            {view === "services" && (
              <section className="services-section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">A LITTLE CARE GOES A LONG WAY</p>
                    <h2>
                      {view === "services"
                        ? "Perawatan yang pas untukmu."
                        : "Pilih layanan, sisanya serahkan kami."}
                    </h2>
                  </div>
                  <span className="small-note">Cabang Cinere</span>
                </div>
                <div className="service-grid">
                  {store.services.map((s, i) => (
                    <button
                      key={s.id}
                      className={`service-card ${i === 0 ? "featured" : ""}`}
                      onClick={() =>
                        s.id === "member" ? setModal("member") : order(s.id)
                      }
                    >
                      <div className="service-top">
                        <span className="service-icon">
                          <Icon service={s} />
                        </span>
                        {i === 0 && (
                          <span className="popular">PALING LENGKAP</span>
                        )}
                      </div>
                      <h3>{s.name}</h3>
                      <p>{s.description}</p>
                      <div className="service-price">
                        <strong>
                          {money(s.id === "wash" ? s.price * 10 : s.price)}
                        </strong>
                        <span> / {s.id === "wash" ? "10 kg" : s.unit}</span>
                      </div>
                      <div className="service-bottom">
                        <span>
                          <Clock size={14} />
                          {s.days}
                        </span>
                        <span className="card-plus">
                          <Plus size={18} />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="pricing-note">
                  <Info size={16} />
                  <span>
                    Cuci-kering{" "}
                    {money(
                      store.services.find((s) => s.id === "wash")!.price * 10,
                    )}{" "}
                    hingga 10 kg. Tambahan setrika{" "}
                    {money(
                      store.services.find((s) => s.id === "complete")!.price -
                        store.services.find((s) => s.id === "wash")!.price,
                    )}
                    /kg. Express +50%. Ongkir dikonfirmasi toko.
                  </span>
                </div>
              </section>
            )}
            {view === "tracking" && (
              <section className="tracking-page">
                <p className="eyebrow">YOUR LAUNDRY, EVERY STEP</p>
                <h1>Sudah sampai mana?</h1>
                <p className="muted">
                  Pantau perjalanan cucianmu dari jemput sampai kembali.
                </p>
                <form
                  className="track-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    load();
                  }}
                >
                  <label className="search-box">
                    <Search size={20} />
                    <input
                      aria-label="Nomor pesanan atau kode tracking"
                      required
                      placeholder="Nomor pesanan atau kode tracking"
                      value={track}
                      onChange={(e) => setTrack(e.target.value)}
                    />
                  </label>
                  <button className="primary">Lacak pesanan</button>
                </form>
                {tracked ? (
                  <Tracking order={tracked} services={store.services} />
                ) : !store.configured && !track ? (
                  <Tracking
                    order={previewTracking}
                    services={store.services}
                    preview
                  />
                ) : track ? (
                  <Empty
                    title="Pesanan belum ditemukan"
                    text={
                      trackingError ||
                      "Masuk dengan Google untuk mencari nomor pesanan, atau gunakan link tracking dari toko."
                    }
                  />
                ) : (
                  <Empty
                    title="Semua perjalanan punya cerita."
                    text="Masukkan nomor pesanan untuk melihat status terbaru cucianmu."
                  />
                )}
                {!!myOrders.length && (
                  <section className="history">
                    <h3>Pesanan kamu</h3>
                    {myOrders.map((o) => (
                      <button key={o.id} onClick={() => setTrack(o.id)}>
                        <Package size={20} />
                        <span>
                          <b>{o.id}</b>
                          <small>
                            {
                              store.services.find((s) => s.id === o.service)
                                ?.name
                            }{" "}
                            · {o.kg} kg
                          </small>
                        </span>
                        <span className="status">{statuses[o.status]}</span>
                      </button>
                    ))}
                  </section>
                )}
              </section>
            )}
          </main>
          <footer>
            <Brand />
            <p>Merawat pakaian. Meringankan harimu.</p>
            <span>
              © {new Date().getFullYear()} D’Fable Laundry Studio · Cinere
            </span>
          </footer>
          <nav className="mobile-nav">
            {[
              ["home", "Beranda", LayoutDashboard],
              ["services", "Layanan", Shirt],
              ["tracking", "Tracking", Package],
            ].map(([v, t, C]) => {
              const Component = C as typeof Shirt;
              return (
                <button
                  key={v as string}
                  className={view === v ? "active" : ""}
                  onClick={() => setView(v as string)}
                >
                  <Component size={20} />
                  {t as string}
                </button>
              );
            })}
            <button onClick={() => setModal("login")}>
              <User size={20} />
              Akun
            </button>
          </nav>
        </>
      )}
      <dialog
        aria-label="Form D’Fable"
        ref={dialog}
        onCancel={() => setModal("")}
        onClick={(e) => {
          if (e.target === dialog.current) setModal("");
        }}
        className={modal === "order" ? "order-dialog" : ""}
      >
        <button
          className="close-button"
          onClick={() => setModal("")}
          aria-label="Tutup"
        >
          <X size={21} />
        </button>
        {modal === "order" && (
          <OrderForm
            services={store.services}
            initialService={service}
            profile={profile}
            pos={dashboard}
            busy={busy}
            submit={async (data) => {
              const result = await action("order", data);
              setTrack(result.id);
              setSelected(
                result.store.orders.find((o: Order) => o.id === result.id),
              );
              setModal("success");
              if (!dashboard) setView("tracking");
            }}
          />
        )}
        {modal === "success" && selected && (
          <div className="success">
            <span className="success-icon">
              <Check size={30} />
            </span>
            <p className="eyebrow">PESANAN TERSIMPAN</p>
            <h2>Selangkah menuju bersih.</h2>
            <p>
              Nomor pesanan kamu <b>{selected.id}</b>. Toko akan mengonfirmasi
              jadwal dan biaya antar-jemput.
            </p>
            <div className="total-line">
              <span>Estimasi layanan</span>
              <b>{money(selected.total)}</b>
            </div>
            <button
              className="primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${location.origin}/?track=${selected.token}`,
                  );
                  notify("Link tracking disalin");
                } catch {
                  notify("Tidak bisa menyalin. Gunakan nomor pesanan di atas.");
                }
              }}
            >
              <Copy size={17} /> Salin link tracking
            </button>
            <button
              className="secondary"
              onClick={() => {
                setModal("");
                if (dashboard) setAdminView("orders");
              }}
            >
              Lihat pesanan
            </button>
          </div>
        )}
        {modal === "login" && (
          <AccountPanel
            phone={profile.phone}
            onDone={() => {
              if (pendingOrder.current) {
                pendingOrder.current = false;
                setModal("order");
              } else setModal("");
            }}
          />
        )}
        {modal === "member" && (
          <div>
            <span className="service-icon">
              <Layers />
            </span>
            <p className="eyebrow">D’FABLE MONTHLY</p>
            <h2>Rutinitas bersih, lebih praktis.</h2>
            <p className="muted">
              Paket demo{" "}
              {money(store.services.find((s) => s.id === "member")!.price)} / 30
              hari untuk 30 kg cuci-kering regular. Aktivasi, sisa kuota, dan
              penagihan membership belum tersedia di tahap demo ini.
            </p>
            <div className="notice">
              <Info size={20} /> Paket ini masih rancangan dan perlu disetujui
              toko.
            </div>
            <button
              className="primary"
              onClick={() => {
                setModal("order");
                setService("wash");
              }}
            >
              Coba pesanan kiloan
            </button>
          </div>
        )}
        {modal === "detail" && selected && (
          <OrderDetail
            order={store.orders.find((o) => o.id === selected.id)!}
            services={store.services}
            busy={busy}
            save={async (d) => {
              await action("update", d);
              notify("Pesanan berhasil diperbarui");
            }}
          />
        )}
      </dialog>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <Package size={34} strokeWidth={1.2} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function OrderForm({
  services,
  initialService,
  profile,
  pos,
  busy,
  submit,
}: {
  services: Service[];
  initialService: string;
  profile: { name: string; phone: string };
  pos: boolean;
  busy: boolean;
  submit: (data: unknown) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [requestId] = useState(() => crypto.randomUUID());
  const [service, setService] = useState(initialService);
  const [kg, setKg] = useState(5);
  const [express, setExpress] = useState(false);
  const [lat, setLat] = useState(-6.3286);
  const [lng, setLng] = useState(106.7844);
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [form, setForm] = useState({
    name: pos ? "" : profile.name,
    phone: pos ? "" : profile.phone,
    address: pos ? "Datang langsung — D’Fable Cinere" : "",
    date: today(),
    slot: "09.00–12.00",
    notes: "",
  });
  const set = (key: string, value: string) =>
    setForm((p) => ({ ...p, [key]: value }));
  async function photoRead(file?: File) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setError("Gunakan JPG, PNG, atau WebP maksimal 8 MB.");
      return;
    }
    setPhotoBusy(true);
    setError("");
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
      const c = document.createElement("canvas");
      c.width = bitmap.width * scale;
      c.height = bitmap.height * scale;
      c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
      bitmap.close();
      setPhoto(c.toDataURL("image/jpeg", 0.75));
    } catch {
      setError("Foto tidak bisa dibaca. Pilih foto lain.");
    } finally {
      setPhotoBusy(false);
    }
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (step === 1) {
          setStep(2);
          return;
        }
        try {
          await submit({
            ...form,
            service,
            kg,
            express,
            lat,
            lng,
            photo,
            source: pos ? "pos" : "web",
            requestId,
          });
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <p className="eyebrow">
        {pos ? "KASIR · CABANG CINERE" : "A FRESH START"}
      </p>
      <h2>{step === 1 ? "Cucianmu butuh apa?" : "Ke mana kami menjemput?"}</h2>
      <div className="form-steps">
        <span className={step === 1 ? "active" : ""}>01 Layanan</span>
        <span className={step === 2 ? "active" : ""}>
          02 {pos ? "Data pelanggan" : "Jadwal & alamat"}
        </span>
      </div>
      {step === 1 ? (
        <>
          <div className="choice-services">
            {services
              .filter((s) => s.id !== "member")
              .map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={service === s.id ? "selected" : ""}
                  onClick={() => setService(s.id)}
                >
                  <Icon service={s} />
                  <span>
                    <b>{s.name}</b>
                    <small>
                      {money(s.id === "wash" ? s.price * 10 : s.price)} /{" "}
                      {s.id === "wash" ? "10 kg" : "kg"}
                    </small>
                  </span>
                  <span className="radio-dot">
                    {service === s.id && <Check size={12} />}
                  </span>
                </button>
              ))}
          </div>
          <label>
            {pos ? "Berat aktual" : "Perkiraan berat"}
            <div className="weight-control">
              <button
                aria-label="Kurangi berat"
                type="button"
                onClick={() => setKg(Math.max(1, kg - 1))}
              >
                <Minus size={17} />
              </button>
              <input
                aria-label="Berat cucian dalam kg"
                type="number"
                min={1}
                max={100}
                step={0.1}
                required
                value={kg}
                onChange={(e) => setKg(Number(e.target.value))}
              />
              <span>kg</span>
              <button
                aria-label="Tambah berat"
                type="button"
                onClick={() => setKg(Math.min(100, kg + 1))}
              >
                <Plus size={17} />
              </button>
            </div>
            <small>Berat final dikonfirmasi setelah ditimbang di studio.</small>
          </label>
          <label>Kecepatan layanan</label>
          <div className="speed-choice">
            <button
              className={!express ? "selected" : ""}
              type="button"
              onClick={() => setExpress(false)}
            >
              <Clock size={18} />
              <b>Regular</b>
              <small>2–3 hari</small>
            </button>
            <button
              className={express ? "selected" : ""}
              type="button"
              onClick={() => setExpress(true)}
            >
              <Wind size={18} />
              <b>Express</b>
              <small>24 jam · +50%</small>
            </button>
          </div>
          <label className="upload">
            {photo ? (
              <img src={photo} alt="Foto cucian" />
            ) : (
              <Camera size={25} />
            )}
            <span>
              <b>{photo ? "Ganti foto cucian" : "Tambahkan foto cucian"}</b>
              <small>Opsional · JPG, PNG, WebP · maks. 8 MB</small>
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => photoRead(e.target.files?.[0])}
            />
          </label>
          {photo && (
            <button
              type="button"
              className="text-button"
              onClick={() => setPhoto("")}
            >
              Hapus foto
            </button>
          )}
          <label>
            Catatan perawatan
            <textarea
              value={form.notes}
              maxLength={1000}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Misalnya: pisahkan baju putih, tanpa pewangi…"
            />
          </label>
        </>
      ) : (
        <>
          <div className="form-two">
            <label>
              Nama pelanggan
              <input
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Nama lengkap"
              />
            </label>
            <label>
              Nomor WhatsApp
              <input
                autoComplete="tel"
                type="tel"
                required
                pattern="(\+62|62|0)8[0-9]{7,12}"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="08xxxxxxxxxx"
              />
            </label>
          </div>
          {!pos && (
            <>
              <label>Titik penjemputan</label>
              <MapPicker
                lat={lat}
                lng={lng}
                onAddress={(address) => set("address", address)}
                onChange={(a, b) => {
                  setLat(a);
                  setLng(b);
                }}
              />
              <label>
                Alamat lengkap & patokan
                <textarea
                  autoComplete="street-address"
                  required
                  minLength={8}
                  maxLength={500}
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Nama jalan, nomor rumah, RT/RW, patokan…"
                />
              </label>
            </>
          )}
          <div className="form-two">
            <label>
              {pos ? "Tanggal masuk" : "Tanggal jemput"}
              <input
                type="date"
                min={today()}
                required
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </label>
            <label>
              Waktu
              <select
                value={form.slot}
                onChange={(e) => set("slot", e.target.value)}
              >
                {["09.00–12.00", "12.00–15.00", "15.00–18.00"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="notice">
            <Info size={18} />
            <span>
              {pos
                ? "Pesanan masuk pada tahap ditimbang. Bagikan link tracking setelah tersimpan."
                : "Jadwal dan ongkir dikonfirmasi toko. Pembayaran transfer dilakukan setelah berat aktual dan tagihan final tersedia."}
            </span>
          </div>
          <label className="checkbox">
            <input type="checkbox" required /> Saya menyetujui berat final dan
            ongkir dikonfirmasi toko. Nomor WhatsApp disimpan untuk pesanan ini
            dan berikutnya.
          </label>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-summary">
        <div>
          <small>Estimasi layanan {express ? "express" : ""}</small>
          <strong>{money(estimate(services, service, kg, express))}</strong>
          <small>Belum termasuk ongkir</small>
        </div>
        <div>
          {step === 2 && (
            <button
              type="button"
              className="secondary"
              onClick={() => setStep(1)}
            >
              Kembali
            </button>
          )}
          <button disabled={busy || photoBusy} className="primary">
            {busy ? "Menyimpan…" : step === 1 ? "Lanjutkan" : "Buat pesanan"}
          </button>
        </div>
      </div>
    </form>
  );
}
function OrderDetail({
  order: o,
  services,
  busy,
  save,
}: {
  order: Order;
  services: Service[];
  busy: boolean;
  save: (data: unknown) => Promise<void>;
}) {
  const [err, setErr] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          await save({
            id: o.id,
            status: Number(f.get("status")),
            actualKg: Number(f.get("weight")),
            paid: f.get("paid") === "on",
            shippingFee:
              f.get("shipping") === "" ? null : Number(f.get("shipping")),
          });
          setErr("");
        } catch (e) {
          setErr((e as Error).message);
        }
      }}
    >
      <p className="eyebrow">
        {o.id} · {o.source === "pos" ? "WALK-IN" : "ONLINE"}
      </p>
      <h2>{o.name}</h2>
      <p className="muted">
        {o.phone} · {services.find((s) => s.id === o.service)?.name}
      </p>
      <div className="detail-address">
        <MapPin size={18} />
        <div>
          {o.address}
          <small>
            {o.date} · {o.slot}
          </small>
          {o.source === "web" && (
            <a
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps?q=${o.lat},${o.lng}`}
            >
              Buka titik jemput
            </a>
          )}
        </div>
      </div>
      {o.notes && (
        <div className="notice">
          <Info size={18} />
          {o.notes}
        </div>
      )}
      {o.photo && <AuthorizedPhoto src={o.photo} />}
      <div className="form-two">
        <label>
          Berat aktual (kg)
          <input
            required
            name="weight"
            type="number"
            step="0.1"
            min="0.1"
            max="100"
            defaultValue={o.actualKg ?? o.kg}
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={o.status}>
            {statuses.map((s, i) => (
              <option disabled={i < o.status} value={i} key={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Ongkir (Rp)
        <input
          name="shipping"
          type="number"
          min="0"
          max="10000000"
          step="1000"
          placeholder="Belum dikonfirmasi"
          defaultValue={o.shippingFee ?? ""}
        />
        <small>Isi 0 jika gratis atau pelanggan ambil di toko.</small>
      </label>
      <label className="checkbox">
        <input name="paid" type="checkbox" defaultChecked={o.paid} /> Transfer
        sudah diperiksa toko
      </label>
      <div className="total-line">
        <span>Total tagihan saat ini</span>
        <b>{money(o.total)}</b>
      </div>
      <p className="muted">
        Total dihitung ulang dari berat aktual dan ongkir saat disimpan.
      </p>
      {err && (
        <p className="form-error" role="alert">
          {err}
        </p>
      )}
      <button disabled={busy} className="primary full">
        {busy ? "Menyimpan…" : "Simpan perubahan"}
      </button>
      <a
        className="text-button full"
        href={`/?track=${o.token}`}
        target="_blank"
      >
        Buka tracking pelanggan
      </a>
    </form>
  );
}
function PriceEditor({
  store,
  save,
}: {
  store: Store;
  save: (data: unknown) => Promise<void>;
}) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel settings-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        const data = store.services.map((s) => ({
          id: s.id,
          price: Number(f.get(s.id)),
        }));
        if (data[0].price < data[1].price) {
          setMsg(
            "Harga layanan lengkap tidak boleh lebih murah dari cuci-kering",
          );
          setBusy(false);
          return;
        }
        try {
          await save(data);
          setMsg("Tersimpan. Pesanan lama tetap memakai harga saat dibuat.");
        } catch (e) {
          setMsg((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Harga layanan cabang Cinere</h3>
      <p className="muted">
        Cuci-kering ditagih minimal 10 kg. Paket lengkap = cuci-kering + selisih
        tarif lengkap per kg untuk setrika.
      </p>
      {store.services.map((s) => (
        <label className="price-edit" key={s.id}>
          <span>
            <b>{s.name}</b>
            <small>Rupiah / {s.unit}</small>
          </span>
          <input
            name={s.id}
            type="number"
            required
            min={1000}
            max={10000000}
            step={1000}
            defaultValue={s.price}
          />
        </label>
      ))}
      <button disabled={busy} className="primary">
        Simpan harga
      </button>
      {msg && <p role="status">{msg}</p>}
    </form>
  );
}
function PromoEditor({
  store,
  save,
}: {
  store: Store;
  save: (data: unknown) => Promise<void>;
}) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel settings-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
          await save({
            title: f.get("title"),
            description: f.get("description"),
            code: f.get("code"),
            active: f.get("active") === "on",
          });
          setMsg("Banner berhasil diperbarui di beranda pelanggan.");
        } catch (e) {
          setMsg((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Banner beranda</h3>
      <label>
        Judul banner
        <input
          required
          name="title"
          minLength={3}
          maxLength={90}
          defaultValue={store.promo.title}
        />
      </label>
      <label>
        Deskripsi
        <textarea
          name="description"
          maxLength={220}
          defaultValue={store.promo.description}
        />
      </label>
      <label>
        Label kampanye
        <input name="code" maxLength={24} defaultValue={store.promo.code} />
        <small>Label saja; tidak otomatis memberikan diskon.</small>
      </label>
      <label className="checkbox">
        <input
          name="active"
          type="checkbox"
          defaultChecked={store.promo.active}
        />{" "}
        Tampilkan banner di web pelanggan
      </label>
      <button disabled={busy} className="primary">
        Simpan banner
      </button>
      {msg && <p role="status">{msg}</p>}
    </form>
  );
}
