import type { Service, Store } from "./types";

const dailyServices: Service[] = [
  {
    id: "complete",
    name: "Cuci Kering Setrika",
    description: "Cucian kiloan dicuci, dikeringkan, dan disetrika.",
    category: "daily",
    price: 8000,
    rates: { regular: 8000, oneDay: 10000, express: 13000, quick: 16000 },
    minimumQuantity: 3,
    unit: "kg",
    days: "3 hari",
    icon: "shirt",
  },
  {
    id: "iron",
    name: "Setrika Kiloan",
    description: "Pakaian disetrika rapi per kilogram.",
    category: "daily",
    price: 5000,
    rates: { regular: 5000, oneDay: 7000, express: 12000, quick: 15000 },
    minimumQuantity: 3,
    unit: "kg",
    days: "3 hari",
    icon: "iron",
  },
  {
    id: "wash",
    name: "Cuci Kering Lipat",
    description: "Paket cuci-kering-lipat, minimal 10 kg.",
    category: "daily",
    price: 25000,
    rates: { regular: 25000, oneDay: 25000, express: 30000, quick: 35000 },
    minimumQuantity: 10,
    packageSize: 10,
    unit: "kg",
    days: "3 hari",
    icon: "wash",
  },
];

const household: Service[] = [
  ["bed-cover-single", "Bed Cover Single", 25000, "pcs"],
  ["bed-cover-double", "Bed Cover Double", 30000, "pcs"],
  ["pillowcase", "Pillowcase (Sarung Bantal)", 5000, "pcs"],
  ["blanket", "Blanket (Selimut)", 25000, "pcs"],
  ["bed-sheet", "Bed Sheet (Sprei)", 15000, "pcs"],
  ["doormat", "Doormats (Keset)", 10000, "pcs"],
  ["sleeping-bag", "Sleeping Bag", 25000, "pcs"],
  ["tablecloth", "Tablecloth (Taplak Meja)", 15000, "pcs"],
  ["towel", "Towel (Handuk)", 15000, "pcs"],
  ["mattress", "Matras", 25000, "pcs"],
  ["sprei-set", "Sprei Set 2 sb + 2 sg", 25000, "set"],
].map(([id, name, price, unit]) => ({
  id: id as string,
  name: name as string,
  description: "Perawatan khusus untuk perlengkapan rumah tangga.",
  category: "household",
  price: price as number,
  unit: unit as string,
  minimumQuantity: 1,
  days: "3 hari",
  icon: "household",
}));

const premium: Service[] = [
  ["tops", "Tops (Kemeja / Blouse)", 20000],
  ["batik", "Batik", 20000],
  ["bottoms", "Bottoms (Celana / Rok / Shorts)", 20000],
  ["alat-ibadah", "Alat Ibadah (Mukena / Sarung / Sajadah)", 10000],
  ["baju-muslim", "Baju Muslim", 20000],
  ["suits", "Suits (Blazer / Jas)", 25000],
  ["jacket", "Jaket (Hoodie / Sweater)", 20000],
  ["cardigan", "Cardigan", 20000],
  ["setelan", "Setelan Baju & Celana", 25000],
  ["jeans", "Jeans", 25000],
  ["dress", "Dress", 20000],
  ["gown", "Gown (Gaun Pesta / Gaun Variasi)", 45000],
  ["coat", "Coat (Mantel / Jaket Tebal)", 40000],
].map(([id, name, price]) => ({
  id: id as string,
  name: name as string,
  description: "Perawatan satuan dengan penanganan lebih teliti.",
  category: "premium",
  price: price as number,
  unit: "pcs",
  minimumQuantity: 1,
  days: "3 hari",
  icon: "premium",
}));

const additional: Service[] = [
  ["noda-ringan", "Noda Ringan", 10000, "pcs"],
  ["noda-berat", "Noda Berat", 20000, "pcs"],
  ["setrika-sprei", "Setrika Sprei Satuan", 5000, "set"],
  ["setrika-handuk", "Setrika Handuk Satuan", 5000, "pcs"],
  ["setrika-pakaian", "Setrika Pakaian Satuan", 5000, "pcs"],
  ["setrika-hijab", "Setrika Hijab Kiloan", 5000, "kg"],
].map(([id, name, price, unit]) => ({
  id: id as string,
  name: name as string,
  description: "Layanan tambahan, dapat dipilih saat membuat pesanan.",
  category: "additional",
  price: price as number,
  unit: unit as string,
  minimumQuantity: 1,
  days: "3 hari",
  icon: "additional",
}));

const member: Service = {
  id: "member",
  name: "D’Fable Monthly",
  description: "Paket bulanan 30 kg, berlaku 30 hari.",
  category: "member",
  price: 150000,
  unit: "bulan",
  minimumQuantity: 1,
  days: "30 hari",
  icon: "member",
};

export const catalogServices: Service[] = [
  ...dailyServices,
  ...household,
  ...premium,
  ...additional,
  member,
];

export const defaultStore: Store = {
  services: catalogServices,
  orders: [],
  promo: {
    title: "Cucian menumpuk? Kami bantu.",
    description: "Cuci kering lipat · 10 kg",
    code: "HELLODFABLE",
    active: true,
  },
};
