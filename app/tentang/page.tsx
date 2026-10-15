import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  LayoutDashboard,
  MessageCircle,
  Package,
  Shirt,
  Store,
  Truck,
  User,
  WashingMachine,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Tentang D’Fable — Laundry Studio",
  description:
    "Kenal lebih dekat dengan D’Fable Hybrid Laundry Studio dan hubungi tim kami melalui WhatsApp.",
};

const whatsappUrl =
  "https://wa.me/6285199300110?text=Halo%20D%27Fable%2C%20saya%20ingin%20bertanya%20tentang%20layanan%20laundry.";

const services = [
  {
    title: "Self Service",
    text: "Cuci dan keringkan sendiri.",
    icon: WashingMachine,
  },
  {
    title: "Full Service",
    text: "Cuci, kering, setrika, dan lipat.",
    icon: Shirt,
  },
  {
    title: "Drop Off",
    text: "Titipkan cucian di gerai.",
    icon: Store,
  },
  {
    title: "Pick Up & Delivery",
    text: "Kami jemput dan antar kembali.",
    icon: Truck,
  },
];

function Brand() {
  return (
    <Link className="brand" href="/" aria-label="D’Fable beranda">
      <img src="/dfable-logo.png" alt="D’Fable Laundry Studio" />
    </Link>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="customer-header">
        <Brand />
        <nav>
          <Link href="/?view=home">Beranda</Link>
          <Link href="/?view=services">Layanan & harga</Link>
          <Link href="/?view=tracking">Lacak pesanan</Link>
          <Link className="active" href="/tentang">
            Tentang D’Fable
          </Link>
        </nav>
        <div className="header-right">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <MessageCircle size={18} />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[1296px] px-5 pb-20 pt-8 sm:px-8 lg:px-12 lg:pb-16 lg:pt-10 xl:px-0">
        <section className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[26px] bg-[#1023a7] shadow-[0_24px_70px_rgba(23,31,111,0.16)] lg:min-h-[520px] lg:grid-cols-[0.78fr_1.22fr]">
          <div className="order-2 min-w-0 px-7 py-9 text-white sm:px-10 sm:py-12 lg:order-1 lg:flex lg:flex-col lg:justify-center lg:px-12">
            <span className="mb-5 text-[10px] font-bold tracking-[0.18em] text-blue-200">
              TENTANG D’FABLE
            </span>
            <h1 className="max-w-[520px] text-[38px] leading-[1.08] tracking-[-0.055em] text-white sm:text-[48px] lg:text-[52px]">
              Satu tempat untuk semua cara mencuci.
            </h1>
            <p className="mt-5 max-w-[500px] text-sm leading-7 text-blue-100 sm:text-[15px]">
              D’Fable mengusung konsep Hybrid Laundry Studio agar pelanggan
              bebas memilih cara yang paling nyaman untuk merawat cucian.
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold !text-[#2621da] transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <MessageCircle size={18} /> Hubungi D’Fable
            </a>
          </div>
          <div className="relative order-1 h-[230px] min-w-0 bg-blue-950 sm:h-auto sm:aspect-[16/10] lg:order-2 lg:aspect-auto">
            <Image
              src="/dfable-storefront.jpg"
              alt="Tampak depan D’Fable Hybrid Laundry Studio"
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 62vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-blue-950/35 to-transparent" />
          </div>
        </section>

        <section className="grid gap-8 py-16 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20 lg:py-24">
          <div>
            <span className="mb-4 block text-[10px] font-bold tracking-[0.18em] text-indigo-600">
              CERITA D’FABLE
            </span>
            <h2 className="max-w-[460px] text-[32px] leading-tight sm:text-[40px]">
              Laundry yang mengikuti cara kamu.
            </h2>
          </div>
          <div className="max-w-[710px] space-y-5 text-[15px] leading-8 text-slate-600 sm:text-base">
            <p>
              D’Fable berawal dari keinginan menghadirkan pengalaman laundry
              yang lebih mudah, jelas, dan fleksibel. Dari kebutuhan itu lahir
              satu studio dengan beberapa pilihan layanan dalam satu tempat.
            </p>
            <p>
              Pelanggan dapat mencuci sendiri, menitipkan cucian kepada tim,
              memilih perawatan lengkap, atau menggunakan layanan jemput dan
              antar. Pengalaman yang sama kemudian dibawa ke web agar layanan,
              pemesanan, dan proses cucian lebih mudah diakses.
            </p>
            <div className="inline-flex rounded-full bg-indigo-50 px-4 py-2 text-xs font-bold tracking-[0.12em] text-indigo-700">
              BERSIH · RAPI · BERDAYA
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 sm:p-9 lg:p-11">
          <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <span className="mb-3 block text-[10px] font-bold tracking-[0.18em] text-indigo-600">
                HYBRID LAUNDRY
              </span>
              <h2 className="mb-0 text-[28px] sm:text-[34px]">
                Pilih layanan yang paling pas.
              </h2>
            </div>
            <p className="mb-0 max-w-[340px] text-sm leading-6 text-slate-500">
              Datang ke gerai atau jadwalkan penjemputan dari rumah.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {services.map(({ title, text, icon: Icon }) => (
              <article
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-[0_14px_35px_rgba(30,41,99,0.09)]"
              >
                <span className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Icon size={21} strokeWidth={1.8} />
                </span>
                <h3 className="mb-2 text-base">{title}</h3>
                <p className="mb-0 text-sm leading-6 text-slate-500">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-[24px] bg-[linear-gradient(120deg,#1712a0_0%,#2621da_58%,#3b82f6_130%)] p-7 text-white sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-12 lg:p-12">
          <div>
            <span className="mb-4 block text-[10px] font-bold tracking-[0.18em] text-blue-200">
              HUBUNGI KAMI
            </span>
            <h2 className="mb-3 text-[30px] text-white sm:text-[38px]">
              Ada yang ingin ditanyakan?
            </h2>
            <p className="mb-0 max-w-[600px] text-sm leading-7 text-blue-100">
              Tim D’Fable siap membantu informasi layanan, pesanan, dan
              penjemputan cucian.
            </p>
          </div>
          <div className="mt-8 shrink-0 lg:mt-0 lg:text-right">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-[24px] font-bold tracking-[-0.03em] text-white sm:text-[28px]"
            >
              +62 851-9930-0110
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold !text-[#2621da] transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <MessageCircle size={18} /> Chat lewat WhatsApp
            </a>
          </div>
        </section>
      </main>

      <footer>
        <Brand />
        <span>© {new Date().getFullYear()} D’Fable Laundry Studio</span>
      </footer>

      <nav className="mobile-nav" aria-label="Navigasi utama">
        <Link href="/?view=home">
          <LayoutDashboard size={20} />
          Beranda
        </Link>
        <Link href="/?view=services">
          <Shirt size={20} />
          Layanan
        </Link>
        <Link href="/?view=tracking">
          <Package size={20} />
          Tracking
        </Link>
        <Link className="active" href="/tentang">
          <Store size={20} />
          Tentang
        </Link>
        <Link href="/?account=1">
          <User size={20} />
          Akun
        </Link>
      </nav>
    </div>
  );
}
