export interface RuntimeEventHost {
  [key: string]: any;
}

export type MerchantPurchaseResult =
  | { kind: "missing_offer" }
  | { kind: "insufficient_obol" }
  | { kind: "delivery_failed" }
  | { kind: "sold_out" }
  | { kind: "remaining_offers" };
