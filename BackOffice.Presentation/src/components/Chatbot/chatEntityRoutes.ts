import type { ChatEntityLinkDto } from "../../types/chatbot";

const ROUTE_MAP: Record<string, (id: string) => string> = {
  customer: (id) => `/customers-list?openId=${encodeURIComponent(id)}`,
  item: (id) => `/items-list?openId=${encodeURIComponent(id)}`,
  supplier: (id) => `/vendor-list?openId=${encodeURIComponent(id)}`,
  purchase_order: (id) => `/purchase-orders-list?openId=${encodeURIComponent(id)}`,
  discount: (id) => `/discounts-list?openId=${encodeURIComponent(id)}`,
  department: (id) => `/departments-list?openId=${encodeURIComponent(id)}`,
  manufacturer: (id) => `/manufacturers-list?openId=${encodeURIComponent(id)}`,
};

export const resolveEntityRoute = (link: ChatEntityLinkDto): string | null => {
  const builder = ROUTE_MAP[link.entityType.toLowerCase()];
  return builder ? builder(link.entityId) : null;
};
