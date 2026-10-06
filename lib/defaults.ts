import type { Store } from "./types";
export const defaultStore: Store = {
  services: [
    {
      id: "complete",
      name: "Cuci, kering & setrika",
      description: "Bersih, wangi, rapi. Tinggal masuk lemari.",
      price: 6000,
      unit: "kg",
      days: "2–3 hari",
      icon: "shirt",
    },
    {
      id: "wash",
      name: "Cuci & kering",
      description: "Paket cuci-kering hingga 10 kg.",
      price: 2000,
      unit: "kg",
      days: "2 hari",
      icon: "wash",
    },
    {
      id: "iron",
      name: "Setrika saja",
      description: "Kembali rapi, siap dipakai.",
      price: 4000,
      unit: "kg",
      days: "1–2 hari",
      icon: "iron",
    },
    {
      id: "member",
      name: "D’Fable Monthly",
      description: "Rancangan paket 30 kg, berlaku 30 hari.",
      price: 150000,
      unit: "bulan",
      days: "30 kg / bulan",
      icon: "member",
    },
  ],
  orders: [],
  promo: {
    title: "Cucian numpuk? Beresin, yuk.",
    description: "Paket cuci-kering hingga 10 kg.",
    code: "HELLODFABLE",
    active: true,
  },
};
