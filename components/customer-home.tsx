"use client";

import { branches } from "@/lib/branches";
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
  MapPin,
  ChevronDown,
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
  const services = [...store.services]
    .sort(
      (a, b) =>
        ["wash", "complete", "iron", "member"].indexOf(a.id) -
        ["wash", "complete", "iron", "member"].indexOf(b.id),
    )
    .filter(
      (s) => s.id !== "member" && (category === "all" || s.id === category),
    );
  const member = store.services.find((s) => s.id === "member")!;

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
        <div className="studio-location">
          <MapPin size={18} />
          <div>
            <strong>D’Fable {branches[store.branchId || "cinere"]}</strong>
          </div>
          <ChevronDown size={16} />
        </div>
      </div>

      <section
        className={`campaign-grid ${!store.promo.active || !content.people.active ? "no-campaign" : ""}`}
        aria-label="Pilihan D’Fable"
      >
        {store.promo.active && (
          <article className="campaign-card">
            <Image
              width={1536}
              height={1024}
              sizes="(max-width: 520px) 100vw, (max-width: 900px) 50vw, 700px"
              src={siteImage(content, "promo")}
              unoptimized
              alt="Mesin cuci putih dan perlengkapan laundry di latar biru"
              className="campaign-photo"
            />
            <div className="campaign-copy">
              <span className="campaign-kicker">
                PROMO PILIHAN {!store.configured && <span>DEMO</span>}
              </span>
              <h2>{store.promo.title}</h2>
              <p className="campaign-price">
                <span>{store.promo.description}</span>
                <strong>{money(wash.price * 10)}</strong>
              </p>
              <button onClick={() => onOrder("wash")}>
                {store.promo.button || "Jemput sekarang"} <Plus size={17} />
              </button>
              <span className="campaign-code">{store.promo.code}</span>
            </div>
          </article>
        )}
        {content.people.active && (
          <article className="people-feature">
            <Image
              width={1536}
              height={1024}
              sizes="(max-width: 520px) 100vw, (max-width: 900px) 50vw, 700px"
              src={siteImage(content, "people")}
              unoptimized
              alt="Petugas laundry merawat cucian di studio putih dan biru"
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
        <div className="browse-heading">
          <h2>Layanan</h2>
          <button onClick={onServices}>Daftar harga</button>
        </div>
        <div className="category-row" role="group" aria-label="Filter layanan">
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
              onClick={() => onOrder(s.id)}
            >
              <div className="photo-service-image">
                <Image
                  width={1536}
                  height={1024}
                  sizes="(max-width: 520px) 100vw, (max-width: 900px) 50vw, 700px"
                  src={siteImage(content, s.id as "wash" | "iron" | "complete")}
                  unoptimized
                  alt={
                    s.id === "wash"
                      ? "Perawatan cucian di studio"
                      : s.id === "iron"
                        ? "Menyetrika kemeja dengan teliti"
                        : "Pakaian bersih terlipat rapi"
                  }
                />
                <span className="photo-service-tag">
                  {s.id === "complete"
                    ? "Favorit"
                    : s.id === "wash"
                      ? "Paket hemat"
                      : "Rapi lagi"}
                </span>
                <span className="photo-service-add">
                  <Plus size={20} />
                </span>
              </div>
              <div className="photo-service-info">
                <h3>{s.name}</h3>
                <div>
                  <strong>
                    {money(s.id === "wash" ? s.price * 10 : s.price)}
                  </strong>
                  <small> / {s.id === "wash" ? "10 kg" : "kg"}</small>
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
            <button className="membership-feature" onClick={onMember}>
              <img
                className="membership-image"
                src={siteImage(content, "member")}
                alt="Paket bulanan"
              />
              <Layers size={34} />

              <h3>{content.member.title}</h3>
              <strong>
                {money(member.price)}
                <small> / bulan</small>
              </strong>
              <p>30 kg · 30 hari · Paket demo</p>
              <span className="membership-link">
                {content.member.button} <Plus size={18} />
              </span>
            </button>
          )}
        </div>
        <p className="compact-terms">
          Cuci-kering minimum 10 kg. Setrika tambahan per kg. Ongkir
          dikonfirmasi toko.
        </p>
      </section>

      <div className="customer-bottom-grid">
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
            <img
              className="monthly-thumb"
              src={siteImage(content, "member")}
              alt="Paket bulanan"
            />
            <div>
              <span>D’FABLE MONTHLY</span>
              <h3>{content.member.title}</h3>
            </div>
            <span className="monthly-action">{content.member.button}</span>
            <Plus size={21} />
          </button>
        )}
      </div>
    </div>
  );
}
