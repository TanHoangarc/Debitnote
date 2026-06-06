import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import mammoth from "mammoth";
import dotenv from "dotenv";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDocs, setDoc, deleteDoc, collection } from "firebase/firestore";
import { firebaseConfigStatic } from "./firebase-config";

// Load environment variables
dotenv.config();

let myFilename = "";
let myDirname = "";

try {
  if (import.meta && import.meta.url) {
    myFilename = fileURLToPath(import.meta.url);
    myDirname = path.dirname(myFilename);
  } else {
    // @ts-ignore
    myFilename = typeof __filename !== "undefined" ? __filename : "";
    // @ts-ignore
    myDirname = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  }
} catch (e) {
  // @ts-ignore
  myFilename = typeof __filename !== "undefined" ? __filename : "";
  // @ts-ignore
  myDirname = typeof __dirname !== "undefined" ? __dirname : process.cwd();
}

const app = express();
const PORT = 3000;

// Set up larger limit for base64 file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Firebase SDK with a failsafe static config fallback
let firebaseConfig = firebaseConfigStatic;
let firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
if (!fs.existsSync(firebaseConfigPath)) {
  firebaseConfigPath = path.join(myDirname, "firebase-applet-config.json");
}
if (!fs.existsSync(firebaseConfigPath)) {
  firebaseConfigPath = path.join(myDirname, "..", "firebase-applet-config.json");
}

if (fs.existsSync(firebaseConfigPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
    console.log("Successfully loaded Firebase configuration from file.");
  } catch (err) {
    console.warn("Error parsing firebase-applet-config.json, falling back to static config:", err);
  }
} else {
  console.log("Firebase config file not found, utilizing bundled static configuration fallback.");
}

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// --- FIREBASE ERROR HANDLING SUPPORT ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Seed Initial Fees List
const defaultFees = [
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

// Seed Initial Customers List
const defaultCustomers = [
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

// Initialize Gemini Client Lazily
let aiClientInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  if (!aiClientInstance) {
    aiClientInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClientInstance;
}

// --- API ROUTES ---

// 1. Master Fees Endpoints
app.get("/api/fees", async (req, res) => {
  try {
    const querySnapshot = await getDocs(collection(db, "fees"));
    let fees = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // In case no fees exist in Firestore yet, seed defaults
    if (fees.length === 0) {
      console.log("Seeding default fees to Firestore...");
      for (const fee of defaultFees) {
        await setDoc(doc(db, "fees", fee.id), {
          id: fee.id,
          description: fee.description,
          vatPercent: fee.vatPercent,
          isPayOnBehalf: fee.isPayOnBehalf,
        });
      }
      fees = defaultFees;
    }
    res.json(fees);
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.LIST, "fees");
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post("/api/fees", async (req, res) => {
  try {
    const newFee = req.body;
    if (!newFee.id) {
      newFee.id = Math.random().toString(36).substring(2, 9);
    }
    const formattedFee = {
      id: String(newFee.id),
      description: String(newFee.description || ""),
      vatPercent: Number(newFee.vatPercent) || 0,
      isPayOnBehalf: Boolean(newFee.isPayOnBehalf),
    };
    await setDoc(doc(db, "fees", formattedFee.id), formattedFee);
    res.json({ success: true, fee: formattedFee });
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, "fees");
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.delete("/api/fees/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await deleteDoc(doc(db, "fees", id));
    res.json({ success: true });
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.DELETE, `fees/${id}`);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

// 2. Master Customers Endpoints
app.get("/api/customers", async (req, res) => {
  try {
    const querySnapshot = await getDocs(collection(db, "customers"));
    let customers = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Seed defaults if empty
    if (customers.length === 0) {
      console.log("Seeding default customers to Firestore...");
      for (const cust of defaultCustomers) {
        await setDoc(doc(db, "customers", cust.id), {
          id: cust.id,
          name: cust.name,
          taxId: cust.taxId,
          address: cust.address,
        });
      }
      customers = defaultCustomers;
    }
    res.json(customers);
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.LIST, "customers");
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post("/api/customers", async (req, res) => {
  try {
    const newCustomer = req.body;
    if (!newCustomer.id) {
      newCustomer.id = Math.random().toString(36).substring(2, 9);
    }
    const formattedCustomer = {
      id: String(newCustomer.id),
      name: String(newCustomer.name || ""),
      taxId: String(newCustomer.taxId || ""),
      address: String(newCustomer.address || ""),
    };
    await setDoc(doc(db, "customers", formattedCustomer.id), formattedCustomer);
    res.json({ success: true, customer: formattedCustomer });
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, "customers");
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.delete("/api/customers/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await deleteDoc(doc(db, "customers", id));
    res.json({ success: true });
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.DELETE, `customers/${id}`);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

async function fetchWithTimeout(url: string, options: any = {}, timeout = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

function extractTaxId(text: string): string | null {
  if (!text) return null;
  const m1 = text.match(/\b\d{10}-\d{3}\b/);
  if (m1) return m1[0];
  const m2 = text.match(/\b\d{13}\b/);
  if (m2) return m2[0];
  const m3 = text.match(/\b\d{10}\b/);
  if (m3) return m3[0];
  const cleaned = text.replace(/[^0-9]/g, "");
  if (cleaned.length === 10 || cleaned.length === 13) {
    return cleaned;
  }
  return null;
}

function checkNameSimilarity(query: string, candidateName: string): boolean {
  if (!query || !candidateName) return false;
  const clean = (s: string) => s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ");
  const qClean = clean(query).split(/\s+/).filter(Boolean);
  const cClean = clean(candidateName).split(/\s+/).filter(Boolean);
  if (qClean.length === 0) return false;
  if (qClean.length <= 2) {
    return qClean.every(word => clean(candidateName).includes(word));
  }
  let overlaps = 0;
  for (const word of qClean) {
    if (["cong", "ty", "tnhh", "co", "phan", "mtv", "mot", "thanh", "vien"].includes(word)) continue;
    if (cClean.includes(word)) {
      overlaps++;
    }
  }
  return overlaps > 0;
}

async function fetchVietQRCompany(taxId: string): Promise<{ name: string; taxId: string; address: string } | null> {
  try {
    const url = `https://api.vietqr.io/v2/business/${taxId}`;
    console.log(`[VietQR-Lookup] Querying tax ID: ${taxId}`);
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    }, 4500);
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        return {
          name: (json.data.name || json.data.displayName || "").toUpperCase(),
          taxId: taxId,
          address: json.data.address || ""
        };
      }
    }
  } catch (e: any) {
    console.warn(`[VietQR-Lookup] Failed for ${taxId}:`, e.message || e);
  }
  return null;
}

async function scrapeExternalSearch(query: string): Promise<string> {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"
  ];
  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

  // Try general DuckDuckGo search first
  try {
    console.log(`[SearchScraper] Fetching DuckDuckGo HTML for query: ${query}`);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetchWithTimeout(searchUrl, {
      headers: {
        "User-Agent": randomUserAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "vi,en-US;q=0.7,en;q=0.3"
      }
    }, 5000);

    if (response.ok) {
      const html = await response.text();
      const bodyStart = html.indexOf("<body");
      if (bodyStart !== -1) {
        const truncated = html.substring(bodyStart, bodyStart + 22000);
        console.log("[SearchScraper] DuckDuckGo general response fetched, length:", truncated.length);
        return truncated;
      }
    }
  } catch (e: any) {
    console.warn("[SearchScraper] DuckDuckGo general search failed:", e.message || e);
  }

  // Try DuckDuckGo site:masothue.com search second
  try {
    console.log(`[SearchScraper] Fetching DuckDuckGo HTML for query: site:masothue.com ${query}`);
    const searchUrl = `https://html.duckduckgo.com/html/?q=site:masothue.com+${encodeURIComponent(query)}`;
    const response = await fetchWithTimeout(searchUrl, {
      headers: {
        "User-Agent": randomUserAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "vi,en-US;q=0.7,en;q=0.3"
      }
    }, 5000);

    if (response.ok) {
      const html = await response.text();
      const bodyStart = html.indexOf("<body");
      if (bodyStart !== -1) {
        const truncated = html.substring(bodyStart, bodyStart + 16000);
        console.log("[SearchScraper] DuckDuckGo response fetched, length:", truncated.length);
        return truncated;
      }
    }
  } catch (e: any) {
    console.warn("[SearchScraper] DuckDuckGo search failed:", e.message || e);
  }

  // Try direct masothue.com search URL third
  try {
    console.log(`[SearchScraper] Fetching masothue.com Search page directly for query: ${query}`);
    const companySearchUrl = `https://masothue.com/Search/?q=${encodeURIComponent(query)}`;
    const response = await fetchWithTimeout(companySearchUrl, {
      headers: {
        "User-Agent": randomUserAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "vi,en-US;q=0.7,en;q=0.3",
        "Referer": "https://masothue.com/"
      }
    }, 5000);

    if (response.ok) {
      const html = await response.text();
      const bodyStart = html.indexOf("<body") !== -1 ? html.indexOf("<body") : 0;
      const truncated = html.substring(bodyStart, bodyStart + 16000);
      console.log("[SearchScraper] Direct masothue.com search page fetched, length:", truncated.length);
      return truncated;
    }
  } catch (e: any) {
    console.warn("[SearchScraper] Direct masothue.com search failed:", e.message || e);
  }

  return "";
}

app.post("/api/search-company", async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }
  
  try {
    // Stage 1: If query itself contains or is a direct tax ID, query VietQR immediately
    const directTaxId = extractTaxId(query);
    if (directTaxId) {
      console.log(`[Search-Company] Query contains a direct Tax ID: ${directTaxId}. Doing database lookup.`);
      const directResult = await fetchVietQRCompany(directTaxId);
      if (directResult) {
        console.log(`[Search-Company] Direct Tax ID lookup success:`, directResult);
        return res.json(directResult);
      }
    }

    // Stage 2: Scrape search engine to look up tax ID candidates
    console.log(`[Search-Company] Name query: "${query}". Initiating scraper candidate search.`);
    const scrapedHtml = await scrapeExternalSearch(`mst ${query}`);
    if (scrapedHtml) {
      const matches10 = scrapedHtml.match(/\b\d{10}\b/g) || [];
      const matches13 = scrapedHtml.match(/\b\d{13}\b/g) || [];
      const matchesHyphed = scrapedHtml.match(/\b\d{10}-\d{3}\b/g) || [];
      
      const rawCandidates = [...matches10, ...matches13, ...matchesHyphed];
      const uniqueCandidates = Array.from(new Set(rawCandidates))
        .map(c => c.trim())
        .filter(c => {
          if (c.startsWith("202") || c.startsWith("201")) {
            return false;
          }
          return true;
        });

      console.log(`[Search-Company] Found ${uniqueCandidates.length} potential tax IDs in scraped content:`, uniqueCandidates);

      // Verify each candidate on VietQR with strict business name matching
      for (const candidate of uniqueCandidates.slice(0, 5)) {
        const companyInfo = await fetchVietQRCompany(candidate);
        if (companyInfo && companyInfo.name) {
          const isSimilar = checkNameSimilarity(query, companyInfo.name);
          if (isSimilar) {
            console.log(`[Search-Company] Match found via scraper candidates:`, companyInfo);
            return res.json(companyInfo);
          } else {
            console.log(`[Search-Company] Scraper candidate ${candidate} (${companyInfo.name}) did not match query "${query}".`);
          }
        }
      }
    }

    // Stage 3: LLM Springboards
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured.",
      });
    }
    const aiClient = getGeminiClient();
    let textInfo = "";
    
    // Attempt 1: Gemini 3.5-flash parses the full scraped HTML
    if (scrapedHtml) {
      try {
        console.log("[Search-Company] Running Attempt 1: Scraped HTML + gemini-3.5-flash parsing");
        const scraperPrompt = `Dưới đây là một phần mã nguồn HTML từ kết quả tìm kiếm/trang web đối với từ khóa doanh nghiệp Việt Nam "${query}".
Hãy phân tích đoạn mã nguồn HTML này để trích xuất chính xác thông tin khớp tốt nhất của một doanh nghiệp Việt Nam tương ứng:
1. Tên chính thức đầy đủ bằng tiếng Việt (Official Company Name - viết hoa đầy đủ, có dấu theo tiếng Việt, ví dụ: CÔNG TY TNHH ABC...).
2. Mã số thuế doanh nghiệp (MST - Gồm dãy số chính xác).
3. Địa chỉ đăng ký kinh doanh chính thức đầy đủ của doanh nghiệp (Address).

Nếu bạn tìm thấy nhiều công ty, hãy chọn công ty khớp nhất với tên tìm kiếm "${query}".

Mã nguồn HTML kết quả:
\"\"\"
${scrapedHtml}
\"\"\"`;

        const response = await aiClient.models.generateContent({
          model: "gemini-3.5-flash",
          contents: scraperPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: {
                  type: Type.STRING,
                  description: "Tên chính thức đầy đủ bằng tiếng Việt của doanh nghiệp (ví dụ viết hoa: CÔNG TY TNHH...)",
                },
                taxId: {
                  type: Type.STRING,
                  description: "Mã số thuế (MST) của doanh nghiệp, gồm chuỗi các chữ số chính xác",
                },
                address: {
                  type: Type.STRING,
                  description: "Địa chỉ đăng ký kinh doanh đầy đủ và chính xác của doanh nghiệp",
                }
              },
              required: ["name", "taxId", "address"]
            }
          }
        });
        textInfo = response.text || "";
      } catch (err1: any) {
        console.warn("[Search-Company] Attempt 1 (Scraper + Gemini) failed:", err1.message || err1);
      }
    }

    // Attempt 2: Grounding Google Search tool as a backup
    if (!textInfo) {
      try {
        console.log("[Search-Company] Running Attempt 2: gemini-3.5-flash + Google Search Tool as backup");
        const defaultPrompt = `Bạn hãy thực hiện tra cứu thông tin doanh nghiệp Việt Nam của "${query}" thông qua Google Search (tìm kiếm trang masothue.com hoặc cổng thông tin doanh nghiệp).
Đóng vai trò là công cụ trích xuất, hãy cung cấp: Tên công ty Việt Nam đầy đủ viết hoa có dấu, Mã số thuế doanh nghiệp, Địa chỉ đầy đủ.`;
        
        const response = await aiClient.models.generateContent({
          model: "gemini-3.5-flash",
          contents: defaultPrompt,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                taxId: { type: Type.STRING },
                address: { type: Type.STRING }
              },
              required: ["name", "taxId", "address"]
            }
          }
        });
        textInfo = response.text || "";
      } catch (err2: any) {
        console.warn("[Search-Company] Attempt 2 (Google Search Tool) failed:", err2.message || err2);
      }
    }

    // Attempt 3: Standard knowledge base fallback query (No Search tools)
    if (!textInfo) {
      try {
        console.log("[Search-Company] Running Attempt 3: Plain gemini-3.5-flash model knowledge fallback");
        const response3 = await aiClient.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Hãy tra cứu hoặc dự đoán thông tin mã số thuế và địa chỉ của doanh nghiệp "${query}" tại Việt Nam từ kiến thức của bạn. Trả về đúng định dạng JSON: {"name": "Tên công ty viết hoa tiếng Việt", "taxId": "Mã số thuế", "address": "Địa chỉ"}. Giữ đúng định dạng và chỉ trả về JSON, không giải thích.`,
          config: {
            responseMimeType: "application/json"
          }
        });
        textInfo = response3.text || "";
      } catch (err3: any) {
        console.warn("[Search-Company] Attempt 3 failed:", err3.message || err3);
      }
    }

    // Attempt 4: Absolute safe mock callback (if all AI queries failed, never crash the app UI)
    if (!textInfo) {
      console.log("[Search-Company] All search methods failed due to general API rate limits. Returning safe mock metadata.");
      return res.json({
        name: query.toUpperCase(),
        taxId: "",
        address: ""
      });
    }

    let cleanedText = textInfo.trim();
    if (cleanedText.includes("```")) {
      const match = cleanedText.match(/```(?:json)?([\s\S]*?)```/);
      if (match && match[1]) {
        cleanedText = match[1].trim();
      }
    }

    const parsedData = JSON.parse(cleanedText);
    res.json({
      name: parsedData.name || "",
      taxId: parsedData.taxId || "",
      address: parsedData.address || ""
    });
  } catch (error: any) {
    console.error("Critical Error in search company API:", error);
    res.json({
      name: query.toUpperCase(),
      taxId: "",
      address: ""
    });
  }
});

// 3. Debit History Endpoints
app.get("/api/history", async (req, res) => {
  try {
    const querySnapshot = await getDocs(collection(db, "history"));
    const debitNotes = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    debitNotes.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
    res.json(debitNotes);
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.LIST, "history");
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post("/api/history", async (req, res) => {
  try {
    const newNote = req.body;
    if (!newNote.id) {
      newNote.id = Math.random().toString(36).substring(2, 9);
    }
    if (!newNote.createdAt) {
      newNote.createdAt = new Date().toISOString();
    }

    const formattedCharges = (newNote.charges || []).map((charge: any) => ({
      id: String(charge.id || Math.random().toString(36).substring(2, 9)),
      description: String(charge.description || "").toUpperCase(),
      qty: Number(charge.qty) || 1,
      price: Number(charge.price) || 0,
      vatPercent: Number(charge.vatPercent) || 0,
      currency: String(charge.currency || "VND"),
      isPayOnBehalf: Boolean(charge.isPayOnBehalf),
    }));

    const formattedNote = {
      id: String(newNote.id),
      companyName: String(newNote.companyName || ""),
      taxId: String(newNote.taxId || ""),
      address: String(newNote.address || ""),
      jobNo: String(newNote.jobNo || ""),
      carrierAgent: String(newNote.carrierAgent || ""),
      etdEta: String(newNote.etdEta || ""),
      hblMbl: String(newNote.hblMbl || ""),
      pol: String(newNote.pol || ""),
      pod: String(newNote.pod || ""),
      volume: String(newNote.volume || ""),
      roe: Number(newNote.roe) || 0,
      note: String(newNote.note || ""),
      createdAt: String(newNote.createdAt),
      charges: formattedCharges,
    };

    await setDoc(doc(db, "history", formattedNote.id), formattedNote);
    res.json({ success: true, debitNote: formattedNote });
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, "history");
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.delete("/api/history/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await deleteDoc(doc(db, "history", id));
    res.json({ success: true });
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.DELETE, `history/${id}`);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

// 4. Gemini Document Data Extraction Endpoint
app.post("/api/extract", async (req, res) => {
  try {
    const { fileBase64, mimeType, fileName } = req.body;
    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: "Missing fileBase64 or mimeType" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured on the server. Please check your Vercel Environment Variables.",
      });
    }

    let aiClient: GoogleGenAI;
    try {
      aiClient = getGeminiClient();
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to initialize Gemini client: " + err.message });
    }

    let extractedText = "";
    let useTextPrompt = false;

    // Direct Docx extraction
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword" ||
      fileName?.endsWith(".docx")
    ) {
      const buffer = Buffer.from(fileBase64, "base64");
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
      useTextPrompt = true;
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

    async function generateJsonWithFallback(contents: any) {
      // Prioritize gemini-2.5-flash for maximum speed (often < 5s) to bypass Vercel's 10s limit
      const isVercel = !!process.env.VERCEL;
      const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
      const maxAttempts = isVercel ? 1 : 2;
      let lastError: any = null;

      for (const model of models) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            console.log(`Attempting structured data extraction with model: ${model} (attempt ${attempt}/${maxAttempts})`);
            const res = await aiClient.models.generateContent({
              model: model,
              contents: contents,
              config: {
                responseMimeType: "application/json",
                responseSchema: debitNoteSchema,
              }
            });
            if (res && res.text) {
              console.log(`Structured data extraction successfully completed with model: ${model} on attempt ${attempt}`);
              return res;
            }
          } catch (error: any) {
            console.warn(`Model ${model} (attempt ${attempt}/${maxAttempts}) failed:`, error.message || error);
            lastError = error;

            // If we have more attempts or models, wait with backoff
            if (model !== models[models.length - 1] || attempt < maxAttempts) {
              const backoffMs = isVercel ? 300 : attempt * 1000;
              console.log(`Retrying after ${backoffMs}ms backoff...`);
              await new Promise((resolve) => setTimeout(resolve, backoffMs));
            }
          }
        }
      }
      throw lastError || new Error("All models failed to extract structured data");
    }

    let response;

    if (useTextPrompt) {
      // Send extracted text to Gemini
      response = await generateJsonWithFallback({
        parts: [
          {
            text: `${promptText}\n\nHere is the raw extracted text of the Word Doc:\n\"\"\"\n${extractedText}\n\"\"\"`
          }
        ]
      });
    } else {
      // Send file content directly as inlineData (multi-modal: PDF or Image)
      response = await generateJsonWithFallback({
        parts: [
          {
            text: promptText,
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: fileBase64,
            }
          }
        ]
      });
    }

    const resultText = response.text || "{}";
    const data = JSON.parse(resultText);
    data.note = ""; // Ensure notes field starts blank for manual entry as requested
    res.json(data);
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    res.status(500).json({ error: error.message || "Failed to extract content via Gemini" });
  }
});


// --- INTEGRATE VITE FOR SPA DEVELOPMENT & DEPLOYMENT ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
export { app };
