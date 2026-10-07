export type Service = {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  days: string;
  icon: string;
};
export type Order = {
  id: string;
  token: string;
  uid: string | null;
  branchId: string;
  name: string;
  phone: string;
  service: string;
  kg: number;
  actualKg: number | null;
  express: boolean;
  address: string;
  lat: number;
  lng: number;
  date: string;
  slot: string;
  notes: string;
  photo: string;
  photoPath?: string;
  status: number;
  paid: boolean;
  shippingFee: number | null;
  total: number;
  unitPrice: number;
  washPrice: number;
  source: "web" | "pos";
  createdAt: string;
  history: { status: number; at: string }[];
};
export type CustomerProfile = { name: string; phone: string; email?: string };
export type Store = {
  branchId?: import("./branches").BranchId;
  content?: import("./site-content").SiteContent;
  services: Service[];
  orders: Order[];
  promo: {
    title: string;
    description: string;
    code: string;
    active: boolean;
    button?: string;
  };
  configured?: boolean;
  isAdmin?: boolean;
  canManageUsers?: boolean;
  role?: "owner" | "admin" | "staff" | "customer";
  profile?: CustomerProfile;
  hasMore?: boolean;
};
export type TrackingOrder = Pick<
  Order,
  | "id"
  | "service"
  | "kg"
  | "actualKg"
  | "express"
  | "status"
  | "paid"
  | "total"
  | "shippingFee"
  | "date"
  | "slot"
  | "history"
  | "createdAt"
>;
export const statuses = [
  "Menunggu konfirmasi",
  "Dijadwalkan jemput",
  "Dalam penjemputan",
  "Ditimbang di toko",
  "Sedang dicuci",
  "Finishing & quality check",
  "Dalam pengantaran",
  "Selesai",
];
export const money = (v: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v);
