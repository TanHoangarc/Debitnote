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
