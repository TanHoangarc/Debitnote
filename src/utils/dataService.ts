import { Customer, Fee, DebitNote, ChargeItem } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

// Standard Master Default Seeds
export const defaultFees: Fee[] = [
  { id: "1", description: "CUỐC BIỂN", vatPercent: 0, isPayOnBehalf: false },
  { id: "2", description: "THC", vatPercent: 8, isPayOnBehalf: false },
  { id: "3", description: "PHÍ BILL", vatPercent: 8, isPayOnBehalf: false },
  { id: "4", description: "PHÍ SEAL", vatPercent: 8, isPayOnBehalf: false },
  { id: "5", description: "PHÍ TELEX", vatPercent: 8, isPayOnBehalf: false },
  { id: "6", description: "KHAI HẢI QUAN", vatPercent: 8, isPayOnBehalf: false },
  { id: "7", description: "KÉO CONT", vatPercent: 8, isPayOnBehalf: false },
  { id: "8", description: "PHÍ NÂNG", vatPercent: 8, isPayOnBehalf: false },
  { id: "9", description: "PHÍ HẠ", vatPercent: 8, isPayOnBehalf: false },
  { id: "10", description: "CƠ SỞ HẠ TẦNG", vatPercent: 0, isPayOnBehalf: true }
];

export const defaultCustomers: Customer[] = [
  {
    id: "1",
    name: "CÔNG TY TNHH MỘT THÀNH VIÊN HOÀNG VINH KHANG",
    taxId: "0313579635",
    address: "64 Nguyễn Văn Cự, KP5, P. Tân Tạo A, Q. Bình Tân, TP. HCM"
  },
  {
    id: "2",
    name: "NOSAFOOD JOINT STOCK COMPANY",
    taxId: "0300482025",
    address: "E4/20 NGUYEN HUU TRI STREET, TAN NHUT COMMUNE, HO CHI MINH CITY, VIETNAM"
  }
];

// In-Memory dynamic cache of backend availability
let _backendAvailable: boolean | null = null;

/**
 * Checks if the Node Express backend is available.
 * If deployed on Vercel static page or backend returns 404/html, fallback to false.
 */
export async function checkBackendAvailability(): Promise<boolean> {
  if (_backendAvailable !== null) return _backendAvailable;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500); // Fast 1.5s timeout
    
    const res = await fetch("/api/fees", { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const contentType = res.headers.get("content-type");
    if (res.ok && contentType && contentType.includes("application/json")) {
      _backendAvailable = true;
    } else {
      _backendAvailable = false;
    }
  } catch (e) {
    _backendAvailable = false;
  }
  return _backendAvailable;
}

// Helper local storage wrappers
function getLocalStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultValue;
  } catch (e) {
    console.error("Local storage read error for key: " + key, e);
    return defaultValue;
  }
}

function setLocalStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Local storage write error for key: " + key, e);
  }
}

// --- FEES SERVICE ---
export async function getFees(): Promise<Fee[]> {
  const hasBackend = await checkBackendAvailability();
  if (hasBackend) {
    try {
      const res = await fetch("/api/fees");
      if (res.ok) {
        const data = await res.json();
        setLocalStorageItem("fees_db", data);
        return data;
      }
    } catch (e) {
      console.warn("Express fees fetch failed, falling back to local storage:", e);
    }
  }
  return getLocalStorageItem<Fee[]>("fees_db", defaultFees);
}

export async function saveFee(fee: Fee): Promise<void> {
  // Update local copy
  const list = await getFees();
  const index = list.findIndex(f => f.id === fee.id);
  if (index >= 0) {
    list[index] = fee;
  } else {
    list.push(fee);
  }
  setLocalStorageItem("fees_db", list);

  // Sync to database
  const hasBackend = await checkBackendAvailability();
  if (hasBackend) {
    try {
      await fetch("/api/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fee),
      });
    } catch (e) {
      console.error("Express sync error saving fee:", e);
    }
  }
}

export async function deleteFee(id: string): Promise<void> {
  // Update local copy
  const list = await getFees();
  const updated = list.filter(f => f.id !== id);
  setLocalStorageItem("fees_db", updated);

  // Sync to database
  const hasBackend = await checkBackendAvailability();
  if (hasBackend) {
    try {
      await fetch(`/api/fees/${id}`, { method: "DELETE" });
    } catch (e) {
      console.error("Express sync error deleting fee:", e);
    }
  }
}


// --- CUSTOMERS SERVICE ---
export async function getCustomers(): Promise<Customer[]> {
  const hasBackend = await checkBackendAvailability();
  if (hasBackend) {
    try {
      const res = await fetch("/api/customers");
      if (res.ok) {
        const data = await res.json();
        setLocalStorageItem("customers_db", data);
        return data;
      }
    } catch (e) {
      console.warn("Express customers fetch failed, falling back to local storage:", e);
    }
  }
  return getLocalStorageItem<Customer[]>("customers_db", defaultCustomers);
}

export async function saveCustomer(customer: Customer): Promise<void> {
  // Update local copy
  const list = await getCustomers();
  const index = list.findIndex(c => c.id === customer.id);
  if (index >= 0) {
    list[index] = customer;
  } else {
    list.push(customer);
  }
  setLocalStorageItem("customers_db", list);

  // Sync to database
  const hasBackend = await checkBackendAvailability();
  if (hasBackend) {
    try {
      await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customer),
      });
    } catch (e) {
      console.error("Express sync error saving customer:", e);
    }
  }
}

export async function deleteCustomer(id: string): Promise<void> {
  // Update local copy
  const list = await getCustomers();
  const updated = list.filter(c => c.id !== id);
  setLocalStorageItem("customers_db", updated);

  // Sync to database
  const hasBackend = await checkBackendAvailability();
  if (hasBackend) {
    try {
      await fetch(`/api/customers/${id}`, { method: "DELETE" });
    } catch (e) {
      console.error("Express sync error deleting customer:", e);
    }
  }
}


// --- DEBIT NOTE HISTORY SERVICE ---
export async function getHistory(): Promise<DebitNote[]> {
  const hasBackend = await checkBackendAvailability();
  if (hasBackend) {
    try {
      const res = await fetch("/api/history");
      if (res.ok) {
        const data = await res.json();
        setLocalStorageItem("history_db", data);
        return data;
      }
    } catch (e) {
      console.warn("Express history fetch failed, falling back to local storage:", e);
    }
  }
  return getLocalStorageItem<DebitNote[]>("history_db", []);
}

export async function saveHistoryNote(note: DebitNote): Promise<DebitNote> {
  const mutableNote = { ...note };
  if (!mutableNote.id) {
    mutableNote.id = Math.random().toString(36).substring(2, 9);
  }
  if (!mutableNote.createdAt) {
    mutableNote.createdAt = new Date().toISOString();
  }

  // Update local copy
  const list = await getHistory();
  const index = list.findIndex(h => h.id === mutableNote.id);
  if (index >= 0) {
    list[index] = mutableNote;
  } else {
    list.unshift(mutableNote); // placing newest first
  }
  setLocalStorageItem("history_db", list);

  // Sync to database
  const hasBackend = await checkBackendAvailability();
  if (hasBackend) {
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutableNote),
      });
      if (res.ok) {
        const resJson = await res.json();
        if (resJson.debitNote) {
          return resJson.debitNote;
        }
      }
    } catch (e) {
      console.error("Express sync error saving history:", e);
    }
  }
  return mutableNote;
}

export async function deleteHistoryNote(id: string): Promise<void> {
  // Update local copy
  const list = await getHistory();
  const updated = list.filter(h => h.id !== id);
  setLocalStorageItem("history_db", updated);

  // Sync to database
  const hasBackend = await checkBackendAvailability();
  if (hasBackend) {
    try {
      await fetch(`/api/history/${id}`, { method: "DELETE" });
    } catch (e) {
      console.error("Express sync error deleting history:", e);
    }
  }
}


// --- GEMINI EXTRACTION FALLBACK FOR VERCEL (CLIENT-SIDE) ---

// Convert Base64 back to Uint8Array for browser mammoth
function base64ToArray(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function extractDocxTextClientSide(fileBase64: string): Promise<string> {
  try {
    // Dynamic import to prevent Vite from failing compilation if mammoth does Node-specific analytical checks on load
    const mammothModule = await import("mammoth");
    const arrayBuffer = base64ToArray(fileBase64);
    const result = await mammothModule.extractRawText({ arrayBuffer });
    return result.value;
  } catch (err: any) {
    console.error("Client docx text extraction failed:", err);
    throw new Error(
      "Không thể trích xuất file Word ở trình duyệt (Vercel). Hãy chuyển đổi tệp Docx sang dạng PDF hoặc ảnh để quét tốt hơn trên Vercel, hoặc chạy thử ứng dụng cục bộ ở máy hỗ trợ Node server."
    );
  }
}

const promptText = `
  You are an expert shipping, customs clearance, and logistics debit note parser.
  Analyze the attached document (either PDF, image, or text of a Word file) and extract key information into a structured JSON payload according to the defined schema.
  
  Look for and resolve:
  - Customer details (usually found under 'CONSIGNEE', 'Shipper', 'TO', or 'Company Name'). Try to extract Tên công ty (Company name), MST (Tax Code), and Địa chỉ (Address) accurately.
  - 'Job' or 'Ref No' parameter.
  - 'Carrier/Agent' (e.g. MSK, COSCO, EMC, ONE, MAERSK).
  - 'ETD/ETA' date. Format strictly as YYYY-MM-DD (e.g. 2026-04-13). If only ETD or ETA is found, use it.
  - 'HBL/MBL' Bill of Lading numbering. Prioritize House Bill of Lading (HBL).
  - 'P.O.L' (Port of Loading) and 'P.O.D' (Port of Discharge), e.g. HCM, TPP, QINGDAO, etc.
  - 'Volume' number / container size details (e.g. 1X40GP, 20GPX1, FCL/LCL, etc).
  - 'R.O.E' (Rate of Exchange, e.g. 25400, 26400, or similar exchange rates to VND) and base Currency Type (usually VND or USD).
  - any descriptive Notes.
  - A comprehensive Table of Charges/Fees. For each charge:
    1. 'description': Extract or map to clean standard description uppercase (e.g. CUỐC BIỂN, THC, PHÍ BILL, PHÍ SEAL, PHÍ TELEX, KHAI HẢI QUAN, KÉO CONT, PHÍ NÂNG, PHÍ HẠ, CƠ SỞ HẠ TẦNG, etc.)
    2. 'qty': Quantity/Unit number (default to 1.00 if unspecified or FCL)
    3. 'price': Price/Unit price of this charge
    4. 'vatPercent': Extract the VAT percentage explicitly (e.g. 0, 8, 10). If not listed:
       - Local handling fees like THC, BILL, SEAL, TELEX, CUSTOMS CLEARANCE, TRUCKING, LIFT ON/OFF normally have an 8% or 10% VAT in Vietnam.
       - Ocean freight (CUỐC BIỂN) normally has 0% VAT.
    5. 'currency': VND or USD
    6. 'isPayOnBehalf': If the charge is an infrastructure charge, local port authority charge, tax reimbursement, or clearly labeled as pay on behalf ('Chi hộ', 'Pay on behalf', 'Đóng hộ'), set this to true. Otherwise false.
`;

const debitNoteSchema = {
  type: Type.OBJECT,
  properties: {
    companyName: { type: Type.STRING },
    taxId: { type: Type.STRING },
    address: { type: Type.STRING },
    jobNo: { type: Type.STRING },
    carrierAgent: { type: Type.STRING },
    etdEta: { type: Type.STRING, description: "Format: YYYY-MM-DD" },
    hblMbl: { type: Type.STRING, description: "Bill of Lading number. Prefer HBL if found" },
    pol: { type: Type.STRING },
    pod: { type: Type.STRING },
    volume: { type: Type.STRING },
    roe: { type: Type.NUMBER },
    currencyType: { type: Type.STRING },
    note: { type: Type.STRING },
    charges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          qty: { type: Type.NUMBER },
          price: { type: Type.NUMBER },
          vatPercent: { type: Type.NUMBER },
          currency: { type: Type.STRING },
          isPayOnBehalf: { type: Type.BOOLEAN }
        },
        required: ["description", "qty", "price", "vatPercent", "currency", "isPayOnBehalf"]
      }
    }
  },
  required: [
    "companyName",
    "taxId",
    "address",
    "jobNo",
    "carrierAgent",
    "etdEta",
    "hblMbl",
    "pol",
    "pod",
    "volume",
    "roe",
    "currencyType",
    "note",
    "charges"
  ]
};

interface ExtractParams {
  fileBase64: string;
  mimeType: string;
  fileName: string;
}

export async function extractDocumentData(params: ExtractParams): Promise<any> {
  const hasBackend = await checkBackendAvailability();

  if (hasBackend) {
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (response.ok) {
        return await response.json();
      } else {
        const errJson = await response.json();
        throw new Error(errJson.error || "Không thể phân tích chứng từ từ backend.");
      }
    } catch (e: any) {
      console.warn("Express /api/extract failed. Running client-side browser Gemini fallback...", e);
      // Fallback to client-side extraction since server had error
    }
  }

  // --- CLIENT HANDLED EXTRACTION VIA DIRECT GOOGLE GENAI ---
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
  if (!apiKey) {
    throw new Error(
      "Không tìm thấy khóa VITE_GEMINI_API_KEY ở môi trường trình duyệt. Vui lòng thiết lập biến môi trường VITE_GEMINI_API_KEY trong Dashboard của Vercel (mục Environment Variables) để thực hiện trích xuất dữ liệu trực tiếp trên Vercel."
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  let extractedText = "";
  let useTextPrompt = false;

  const isDocx =
    params.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    params.mimeType === "application/msword" ||
    params.fileName?.endsWith(".docx");

  if (isDocx) {
    extractedText = await extractDocxTextClientSide(params.fileBase64);
    useTextPrompt = true;
  }

  // Same strategy fallback models as the backend server did
  const models = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Client] Quét văn bản với mẫu: ${model} (lần thử ${attempt}/3)`);
        
        let contents;
        if (useTextPrompt) {
          contents = [
            {
              text: `${promptText}\n\nHere is the raw extracted text of the Word Doc:\n\"\"\"\n${extractedText}\n\"\"\"`
            }
          ];
        } else {
          contents = [
            {
              text: promptText,
            },
            {
              inlineData: {
                mimeType: params.mimeType,
                data: params.fileBase64,
              }
            }
          ];
        }

        const res = await ai.models.generateContent({
          model: model,
          contents: contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: debitNoteSchema,
          }
        });

        if (res && res.text) {
          console.log(`[Client] Trích xuất thành công bằng chatbot: ${model}`);
          const parsed = JSON.parse(res.text);
          parsed.note = ""; // Default empty note column for safety
          return parsed;
        }
      } catch (error: any) {
        console.warn(`[Client] Mẫu ${model} thất bại ở lần ${attempt}:`, error.message || error);
        lastError = error;

        if (model !== models[models.length - 1] || attempt < 3) {
          const backoff = attempt * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }
  }

  throw lastError || new Error("Tất cả các dòng máy học Gemini của chúng tôi đều gặp sự cố khi trích xuất dữ liệu.");
}
