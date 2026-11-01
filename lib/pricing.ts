export function calculatePrice(
  service: string,
  kg: number,
  unitPrice: number,
  washPrice: number,
  express: boolean,
) {
  const base =
    service === "wash"
      ? Math.max(10, kg) * unitPrice
      : service === "complete"
        ? Math.max(10, kg) * washPrice + kg * (unitPrice - washPrice)
        : kg * unitPrice;
  return Math.round(base * (express ? 1.5 : 1));
}

export function calculateOrderPrice(
  order: {
    service: string;
    kg: number;
    unitPrice: number;
    washPrice: number;
    express: boolean;
    pricingVersion?: number;
    minimumQuantity?: number;
  },
  quantity = order.kg,
) {
  if (order.pricingVersion === 2)
    return Math.round(
      Math.max(order.minimumQuantity || 1, quantity) * order.unitPrice,
    );
  return calculatePrice(
    order.service,
    quantity,
    order.unitPrice,
    order.washPrice,
    order.express,
  );
}

export function normalizePhone(phone: string) {
  const digits = phone.replace(/[\s()-]/g, "");
  return digits.startsWith("0")
    ? `+62${digits.slice(1)}`
    : digits.startsWith("62")
      ? `+${digits}`
      : digits;
}
