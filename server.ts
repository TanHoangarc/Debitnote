import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import mammoth from "mammoth";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

let _filename = "";
let _dirname = "";

try {
  const metaUrl = typeof import.meta !== "undefined" && import.meta.url ? import.meta.url : "";
  if (metaUrl) {
    _filename = fileURLToPath(metaUrl);
    _dirname = path.dirname(_filename);
  }
} catch (e) {
  // ignore
}

if (!_filename && typeof __filename !== "undefined") {
  _filename = __filename;
}
if (!_dirname && typeof __dirname !== "undefined") {
  _dirname = __dirname;
}

if (!_dirname) {
  _dirname = process.cwd();
}

const app = express();
const PORT = 3000;

// Set up larger limit for base64 file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Data Directory and persistence setup
const DATA_DIR = path.join(_dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const HISTORY_FILE = path.join(DATA_DIR, "history.json");
const FEES_FILE = path.join(DATA_DIR, "fees.json");
const CUSTOMERS_FILE = path.join(DATA_DIR, "customers.json");

// Helper read/write files safely
function readJsonFile<T>(filePath: string, defaultData: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), "utf8");
      return defaultData;
    }
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return defaultData;
  }
}

function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
  }
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

// Load current lists from disk
let feesList = readJsonFile(FEES_FILE, defaultFees);
let customersList = readJsonFile(CUSTOMERS_FILE, defaultCustomers);
let debitHistoryList = readJsonFile(HISTORY_FILE, [] as any[]);

// Ensure databases stay synchronized
writeJsonFile(FEES_FILE, feesList);
writeJsonFile(CUSTOMERS_FILE, customersList);

// Lazy Dynamic Gemini Client Setup
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (ai) return ai;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured on the server. Please add GEMINI_API_KEY into your Vercel Environment Variables.");
  }
  ai = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
  return ai;
}

// --- API ROUTES ---

// 1. Master Fees Endpoints
app.get("/api/fees", (req, res) => {
  feesList = readJsonFile(FEES_FILE, defaultFees);
  res.json(feesList);
});

app.post("/api/fees", (req, res) => {
  const newFee = req.body;
  if (!newFee.id) {
    newFee.id = Math.random().toString(36).substring(2, 9);
  }
  const existingIndex = feesList.findIndex((f) => f.id === newFee.id);
  if (existingIndex >= 0) {
    feesList[existingIndex] = newFee;
  } else {
    feesList.push(newFee);
  }
  writeJsonFile(FEES_FILE, feesList);
  res.json({ success: true, fee: newFee });
});

app.delete("/api/fees/:id", (req, res) => {
  const { id } = req.params;
  feesList = feesList.filter((f) => f.id !== id);
  writeJsonFile(FEES_FILE, feesList);
  res.json({ success: true });
});

// 2. Master Customers Endpoints
app.get("/api/customers", (req, res) => {
  customersList = readJsonFile(CUSTOMERS_FILE, defaultCustomers);
  res.json(customersList);
});

app.post("/api/customers", (req, res) => {
  const newCustomer = req.body;
  if (!newCustomer.id) {
    newCustomer.id = Math.random().toString(36).substring(2, 9);
  }
  const existingIndex = customersList.findIndex((c) => c.id === newCustomer.id);
  if (existingIndex >= 0) {
    customersList[existingIndex] = newCustomer;
  } else {
    customersList.push(newCustomer);
  }
  writeJsonFile(CUSTOMERS_FILE, customersList);
  res.json({ success: true, customer: newCustomer });
});

app.delete("/api/customers/:id", (req, res) => {
  const { id } = req.params;
  customersList = customersList.filter((c) => c.id !== id);
  writeJsonFile(CUSTOMERS_FILE, customersList);
  res.json({ success: true });
});

// 3. Debit History Endpoints
app.get("/api/history", (req, res) => {
  debitHistoryList = readJsonFile(HISTORY_FILE, [] as any[]);
  res.json(debitHistoryList);
});

app.post("/api/history", (req, res) => {
  const newNote = req.body;
  if (!newNote.id) {
    newNote.id = Math.random().toString(36).substring(2, 9);
  }
  if (!newNote.createdAt) {
    newNote.createdAt = new Date().toISOString();
  }
  const existingIndex = debitHistoryList.findIndex((n) => n.id === newNote.id);
  if (existingIndex >= 0) {
    debitHistoryList[existingIndex] = newNote;
  } else {
    debitHistoryList.unshift(newNote); // Put newest first
  }
  writeJsonFile(HISTORY_FILE, debitHistoryList);
  res.json({ success: true, debitNote: newNote });
});

app.delete("/api/history/:id", (req, res) => {
  const { id } = req.params;
  debitHistoryList = debitHistoryList.filter((n) => n.id !== id);
  writeJsonFile(HISTORY_FILE, debitHistoryList);
  res.json({ success: true });
});

// 4. Gemini Document Data Extraction Endpoint
app.post("/api/extract", async (req, res) => {
  try {
    const { fileBase64, mimeType, fileName } = req.body;
    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: "Missing fileBase64 or mimeType" });
    }

    let aiInstance: GoogleGenAI;
    try {
      aiInstance = getGeminiClient();
    } catch (err: any) {
      return res.status(500).json({
        error: err.message || "GEMINI_API_KEY is not configured on the server. Please check your Vercel Environment Variables.",
      });
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
      const models = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"];
      let lastError: any = null;

      for (const model of models) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`Attempting structured data extraction with model: ${model} (attempt ${attempt}/3)`);
            const res = await aiInstance.models.generateContent({
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
            console.warn(`Model ${model} (attempt ${attempt}/3) failed:`, error.message || error);
            lastError = error;

            // If we have more attempts or models, wait with backoff
            if (model !== models[models.length - 1] || attempt < 3) {
              const backoffMs = attempt * 1000;
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
      response = await generateJsonWithFallback([
        {
          text: `${promptText}\n\nHere is the raw extracted text of the Word Doc:\n\"\"\"\n${extractedText}\n\"\"\"`
        }
      ]);
    } else {
      // Send file content directly as inlineData (multi-modal: PDF or Image)
      response = await generateJsonWithFallback([
        {
          text: promptText,
        },
        {
          inlineData: {
            mimeType: mimeType,
            data: fileBase64,
          }
        }
      ]);
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
import { createServer as createViteServer } from "vite";

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
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

startServer();
