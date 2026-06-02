export interface Customer {
  id: string;
  name: string;
  taxId: string;
  address: string;
}

export interface Fee {
  id: string;
  description: string;
  vatPercent: number;
  isPayOnBehalf: boolean;
}

export interface ChargeItem {
  id: string;
  description: string;
  qty: number;
  price: number;
  vatPercent: number;
  currency: string; // e.g., "VND", "USD", "EUR", "GBP"
  isPayOnBehalf: boolean; // "Chi hộ" checkbox column
}

export interface DebitNote {
  id: string;
  companyName: string;
  taxId: string;
  address: string;
  jobNo: string;
  carrierAgent: string;
  etdEta: string; // ETA / ETD date string (formatted)
  hblMbl: string;
  pol: string;
  pod: string;
  volume: string;
  volumeQty?: number;
  volumeUnit?: string;
  roe: number; // Rate of exchange, e.g., 26400
  note: string;
  charges: ChargeItem[];
  createdAt: string;
  exchangeRates?: { [currency: string]: number };
}
