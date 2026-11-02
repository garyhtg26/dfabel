"use client";

import { useState } from "react";
import Image from "next/image";
import {
  WashingMachine,
  Shirt,
  Wind,
  Layers,
  Grid2X2,
  Plus,
  Package,
  Truck,
  Clock,
  Search,
  User,
  Check,
} from "lucide-react";
import { money, type Store } from "@/lib/types";
import "./customer-home.css";
import { siteContent, siteImage } from "@/lib/site-content";

type Props = {
  store: Store;
  name: string;
  onOrder: (service?: string) => void;
  onMember: () => void;
  onTrack: (code?: string) => void;
  onAccount: () => void;
  onServices: () => void;
};
const categories = [
  { id: "all", label: "Semua", icon: Grid2X2 },
  { id: "wash", label: "Cuci kering", icon: WashingMachine },
  { id: "iron", label: "Setrika", icon: Wind },
  { id: "complete", label: "Lengkap", icon: Shirt },
  { id: "member", label: "Bulanan", icon: Layers },
];

export default function CustomerHome({
  store,
  name,
  onOrder,
  onMember,
  onTrack,
  onAccount,
  onServices,
}: Props) {
  const content = siteContent(store.content);
  const [category, setCategory] = useState("all");
  const [code, setCode] = useState("");
  const wash = store.services.find((s) => s.id === "wash")!;
  const services = store.services
    .filter((service) => service.category === "daily")
    .sort(
      (a, b) =>
        ["wash", "complete", "iron"].indexOf(a.id) -
        ["wash", "complete", "iron"].indexOf(b.id),
    )
    .filter((service) => category === "all" || service.id === category);
  const member = store.services.find((s) => s.id === "member")!;
  const promoImage = siteImage(content, "promo");
  const peopleImage = siteImage(content, "people");
  const memberImage = siteImage(content, "member");

  return (
    <div className="customer-experience">
      <div className="app-welcome">
        <div>
          <h1>{name ? `Halo, ${name}` : "D’Fable Laundry"}</h1>
        </div>
        <button
          className="welcome-account"
          onClick={onAccount}
          aria-label="Buka profil"
        >
          <User size={23} />
        </button>
      </div>

      <section
        className={`campaign-grid ${!store.promo.active || !content.people.active ? "no-campaign" : ""}`}
        aria-label="Pilihan D’Fable"
      >
        {store.promo.active && (
          <article className="campaign-card" data-scroll-reveal>
            <Image
              width={1536}
              height={1024}
              sizes="(max-width: 520px) 100vw, (max-width: 900px) 50vw, 700px"
              src={promoImage}
              unoptimized={!promoImage.startsWith("/api/")}
              fetchPriority="high"
              loading="eager"
              alt="Mesin cuci dan perlengkapan laundry"
              className="campaign-photo"
            />
            <div className="campaign-copy">
              <span className="campaign-kicker">PROMO PILIHAN</span>
              <h2>{store.promo.title}</h2>
              <p className="campaign-price">
                <span>{store.promo.description}</span>
                <strong>{money(wash.price)}</strong>
              </p>
              <button onClick={() => onOrder("wash")}>
                {store.promo.button || "Jemput sekarang"} <Plus size={17} />
              </button>
              <span className="campaign-code">{store.promo.code}</span>
            </div>
          </article>
        )}
        {content.people.active && (
          <article className="people-feature" data-scroll-reveal>
            <Image
              width={1536}
              height={1024}
              sizes="(max-width: 520px) 100vw, (max-width: 900px) 50vw, 700px"
              src={peopleImage}
              unoptimized={!peopleImage.startsWith("/api/")}
              loading={store.promo.active ? "lazy" : "eager"}
              fetchPriority={store.promo.active ? "auto" : "high"}
              alt="Aktivitas mencuci di tempat laundry"
            />
            <div className="people-copy">
              <h2>{content.people.title}</h2>
              <button onClick={() => onOrder()}>
                <Truck size={18} /> {content.people.button}
              </button>
            </div>
          </article>
        )}
      </section>

      <section className="browse-laundry" aria-label="Pilih layanan">
        <div className="browse-heading" data-scroll-reveal>
          <h2>Layanan</h2>
          <button onClick={onServices}>Daftar harga</button>
        </div>
        <div
          className="category-row"
          role="group"
          aria-label="Filter layanan"
          data-scroll-reveal
        >
          {categories
            .filter((c) => c.id !== "member" || content.member.active)
            .map(({ id, label, icon: Icon }) => (
              <button
                aria-pressed={category === id}
                key={id}
                className={category === id ? "selected" : ""}
                onClick={() => setCategory(id)}
              >
                <span>
                  <Icon size={26} strokeWidth={1.6} />
                </span>
                <b>{label}</b>
              </button>
            ))}
        </div>
        <div className="photo-service-grid">
          {services.map((s) => (
            <button
              key={s.id}
              className={`photo-service service-${s.id}`}
              data-scroll-reveal
              onClick={() => onOrder(s.id)}
            >
              <div className="photo-service-image">
                <Image
                  width={1536}
                  height={1024}
                  sizes="(max-width: 520px) 100vw, (max-width: 900px) 50vw, 700px"
                  src={siteImage(content, s.id as "wash" | "iron" | "complete")}
                  unoptimized={
                    !siteImage(
                      content,
                      s.id as "wash" | "iron" | "complete",
                    ).startsWith("/api/")
                  }
                  alt={
                    s.id === "wash"
                      ? "Deretan pakaian bersih"
                      : s.id === "iron"
                        ? "Proses menyetrika pakaian"
                        : "Tumpukan pakaian bersih di laundry"
                  }
                />
                <span className="photo-service-tag">
                  {s.id === "complete"
                    ? "Favorit"
                    : s.id === "wash"
                      ? "Paket hemat"
                      : "Setrika"}
                </span>
                <span className="photo-service-add">
                  <Plus size={20} />
                </span>
              </div>
              <div className="photo-service-info">
                <h3>{s.name}</h3>
                <div>
                  <strong>{money(s.price)}</strong>
                  <small>
                    / {s.packageSize ? `${s.packageSize} kg` : s.unit}
                  </small>
                </div>
                <p>
                  <Clock size={14} />
                  {s.days}
                  <span />
                  <Truck size={14} />
                  Jemput & antar
                </p>
              </div>
            </button>
          ))}
          {category === "member" && content.member.active && (
            <button
              className="photo-service membership-feature"
              data-scroll-reveal
              onClick={onMember}
            >
              <div className="photo-service-image">
                <Image
                  width={1536}
                  height={1024}
                  sizes="(max-width: 520px) 100vw, (max-width: 900px) 50vw, 700px"
                  unoptimized={!memberImage.startsWith("/api/")}
                  src={memberImage}
                  alt="Paket bulanan"
                />
                <span className="photo-service-tag">Paket bulanan</span>
                <span className="photo-service-add">
                  <Plus size={20} />
                </span>
              </div>
              <div className="photo-service-info">
                <h3>{content.member.title}</h3>
                <div>
                  <strong>{money(member.price)}</strong>
                  <small> / bulan</small>
                </div>
                <p>
                  <Layers size={14} />
                  30 kg
                  <span />
                  <Clock size={14} />
                  30 hari
                </p>
              </div>
            </button>
          )}
        </div>
        <p className="compact-terms">
          Kiloan minimal 3 kg, cuci kering lipat minimal 10 kg. Ongkir
          dikonfirmasi toko.
        </p>
      </section>

      <div className="customer-bottom-grid" data-scroll-reveal>
        {content.tracking.active && (
          <section className="tracking-ribbon">
            <span className="ribbon-icon">
              <Package size={27} />
            </span>
            <div>
              <h2>{content.tracking.title}</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onTrack(code);
              }}
            >
              <label>
                <Search size={18} />
                <input
                  required
                  aria-label="Nomor pesanan"
                  placeholder="Nomor pesanan"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button type="submit">Lacak</button>
            </form>
          </section>
        )}
        {content.member.active && (
          <button className="monthly-strip" onClick={onMember}>
            <Image
              width={120}
              height={120}
              sizes="80px"
              unoptimized={!memberImage.startsWith("/api/")}
              className="monthly-thumb"
              src={memberImage}
              alt="Paket bulanan"
            />
            <div className="monthly-copy">
              <span className="monthly-kicker">D’FABLE MONTHLY</span>
              <h3>{content.member.title}</h3>
            </div>
            <span className="monthly-action">
              <span>{content.member.button}</span>
              <Plus size={18} aria-hidden="true" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
