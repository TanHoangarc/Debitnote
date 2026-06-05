import React, { useState, useEffect } from "react";
import { DebitNote, Customer, Fee, ChargeItem } from "./types";
import DebitNoteForm from "./components/DebitNoteForm";
import DebitNotePreview from "./components/DebitNotePreview";
import HistorySidebar from "./components/HistorySidebar";
import MasterDataTab from "./components/MasterDataTab";
import { Upload, FileText, Database, Layers, Sparkles, RefreshCw, Printer, AlertTriangle, CheckSquare, X } from "lucide-react";
import { extractDocumentData } from "./utils/dataService";

const parseVolume = (volumeStr: string): { qty?: number; unit: string } => {
  const clean = (volumeStr || "").trim().toUpperCase();
  if (!clean) return { qty: undefined, unit: "" };

  // Match pattern like: 2 X 40HQ or 2X40HQ or 2*40HQ or 2-40HQ
  const xMatch = clean.match(/^(\d+(?:\.\d+)?)\s*[X*x\-]\s*([A-Z0-9]+)$/);
  if (xMatch) {
    return { qty: parseFloat(xMatch[1]) || undefined, unit: xMatch[2] };
  }

  // Match pattern like: 40HQ X 2 or 40HQ*2 or 40HQ-2
  const xRevMatch = clean.match(/^([A-Z0-9]+)\s*[X*x\-]\s*(\d+(?:\.\d+)?)$/);
  if (xRevMatch) {
    return { qty: parseFloat(xRevMatch[2]) || undefined, unit: xRevMatch[1] };
  }

  // Match pattern like: 2 40HQ
  const spaceMatch = clean.match(/^(\d+(?:\.\d+)?)\s+([A-Z0-9]+)$/);
  if (spaceMatch) {
    return { qty: parseFloat(spaceMatch[1]) || undefined, unit: spaceMatch[2] };
  }

  // Match pattern like: 40HQ 2
  const spaceRevMatch = clean.match(/^([A-Z0-9]+)\s+(\d+(?:\.\d+)?)$/);
  if (spaceRevMatch) {
    return { qty: parseFloat(spaceRevMatch[2]) || undefined, unit: spaceRevMatch[1] };
  }

  // Match standard container names directly from list optionally if standard prefix/suffix
  const knownUnits = ["20GP", "40GP", "40HQ", "45HQ", "20RF", "40RF", "CBM", "KGS"];
  for (const unit of knownUnits) {
    if (clean.includes(unit)) {
      const numbers = clean.replace(unit, "").match(/\d+(?:\.\d+)?/);
      const qty = numbers ? (parseFloat(numbers[0]) || undefined) : undefined;
      return { qty, unit };
    }
  }

  // Match if it's just a number
  if (/^\d+(?:\.\d+)?$/.test(clean)) {
    return { qty: parseFloat(clean) || undefined, unit: "" };
  }

  return { qty: undefined, unit: clean };
};

const createNewBlankDebitNote = (): DebitNote => ({
  id: "",
  companyName: "",
  taxId: "",
  address: "",
  jobNo: "",
  carrierAgent: "",
  etdEta: new Date().toISOString().substring(0, 10),
  hblMbl: "",
  pol: "",
  pod: "",
  volume: "",
  volumeQty: undefined,
  volumeUnit: "",
  roe: 0,
  note: "",
  charges: [],
  createdAt: "",
  exchangeRates: {},
});

export default function App() {
  // Navigation active tab: 'debit' or 'data'
  const [activeTab, setActiveTab] = useState<"debit" | "data">("debit");

  // Core database state synchronized with Express server
  const [history, setHistory] = useState<DebitNote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);

  // Active document editing
  const [activeNote, setActiveNote] = useState<DebitNote>(createNewBlankDebitNote());
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Parsing indicator states
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgressMessage, setExtractProgressMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Status logs used to entertain operators while Gemini runs
  const loadingStatusTimeline = [
    "Đang chuẩn bị luồng dữ liệu tệp tải lên...",
    "Đang mã hóa văn bản nhị phân thành Base64...",
    "Đang kết nối tới máy chủ trích xuất thông tin...",
    "Đang phân tích thông tin bằng trí tuệ nhân tạo Gemini 3.5-Flash...",
    "Nhận dạng và phân tích kết cấu chứng từ Logistics...",
    "Trích xuất tên công ty, MST và địa chỉ doanh nghiệp...",
    "Trích xuất thông số vận đơn (Consignee, HBL/MBL, Voyage)...",
    "Phân tích bảng kê cước phí dịch vụ có VAT...",
    "Nhận diện các phí chi hộ (Pay on Behalf) đặc thù...",
    "Tính toán hoàn thiện dữ liệu để kết xuất form mẫu..."
  ];

  // Fetch initial master lists on mount
  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    try {
      const [resHistory, resCustomers, resFees] = await Promise.all([
        fetch("/api/history").then((r) => r.json()),
        fetch("/api/customers").then((r) => r.json()),
        fetch("/api/fees").then((r) => r.json()),
      ]);
      setHistory(resHistory || []);
      setCustomers(resCustomers || []);
      setFees(resFees || []);
    } catch (err) {
      console.error("Lỗi lấy dữ liệu từ server:", err);
    }
  };

  // Client-side image resizing and optimization to prevent 4.5MB Vercel payload limit crashes
  const resizeImageIfNeeded = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Giảm maxDim xuống 1024 để tăng tốc độ truyền tải trên Vercel
          const maxDim = 1024;
          let width = img.width;
          let height = img.height;
          
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
            
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              // Giảm chất lượng JPEG xuống 0.75 để tối ưu tối đa dung lượng Base64
              const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
              resolve(compressedBase64.split(",")[1]);
              return;
            }
          }
          // If already small or error, resolve original
          if (e.target?.result) {
            resolve((e.target.result as string).split(",")[1]);
          } else {
            resolve("");
          }
        };
        img.onerror = () => {
          if (e.target?.result) {
            resolve((e.target.result as string).split(",")[1]);
          } else {
            resolve("");
          }
        };
        if (e.target?.result) {
          img.src = e.target.result as string;
        } else {
          resolve("");
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Safe file upload handler
  const handleFileUpload = async (file: File) => {
    setIsExtracting(true);
    setExtractError(null);
    setExtractProgressMessage(loadingStatusTimeline[0]);

    // Serverless platforms like Vercel have a strict 4.5MB payload size limit.
    // Check non-image file sizes before uploading to avoid server crashes.
    if (!file.type.startsWith("image/") && file.size > 3.8 * 1024 * 1024) {
      setIsExtracting(false);
      setExtractError("Kích thước tệp quá lớn (vượt quá 3.8MB). Vui lòng nén file PDF hoặc chọn tệp nhỏ hơn để tránh quá tải đường truyền.");
      return;
    }

    // Cycling status messages realistically
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < loadingStatusTimeline.length) {
        setExtractProgressMessage(loadingStatusTimeline[step]);
      }
    }, 1500);

    try {
      let base64Content = "";

      if (file.type.startsWith("image/")) {
        setExtractProgressMessage("Đang tối ưu hóa dung lượng hình ảnh...");
        base64Content = await resizeImageIfNeeded(file);
      } else {
        const reader = new FileReader();
        const fileLoadedPromise = new Promise<string>((resolve) => {
          reader.onload = () => {
            const res = reader.result as string;
            // Strip data:image/png;base64, prefix
            const base64Data = res.split(",")[1];
            resolve(base64Data);
          };
        });
        reader.readAsDataURL(file);
        base64Content = await fileLoadedPromise;
      }

      // Sử dụng dataService xử lý trích xuất (có fallback phía Trình duyệt để tránh lỗi Vercel)
      const extracted = await extractDocumentData({
        fileBase64: base64Content,
        mimeType: file.type || "application/octet-stream",
        fileName: file.name,
      });

      clearInterval(interval);

      // Formulate unique IDs for extracted charges
      const parsedCharges: ChargeItem[] = (extracted.charges || []).map((charge: any) => ({
        id: Math.random().toString(36).substring(2, 9),
        description: (charge.description || "").toUpperCase(),
        qty: Number(charge.qty) || 1,
        price: Number(charge.price) || 0,
        vatPercent: Number(charge.vatPercent) || 0,
        currency: charge.currency || "VND",
        isPayOnBehalf: !!charge.isPayOnBehalf,
      }));

      // Bind extracted data into form
      const parsedVol = parseVolume(extracted.volume || "");
      setActiveNote({
        id: "", // Blank ID indicates a new entry
        companyName: extracted.companyName || "",
        taxId: extracted.taxId || "",
        address: extracted.address || "",
        jobNo: extracted.jobNo || activeNote.jobNo,
        carrierAgent: extracted.carrierAgent || "",
        etdEta: extracted.etdEta || new Date().toISOString().substring(0, 10),
        hblMbl: extracted.hblMbl || "",
        pol: extracted.pol || "",
        pod: extracted.pod || "",
        volume: extracted.volume || "",
        volumeQty: parsedVol.qty,
        volumeUnit: parsedVol.unit,
        roe: Number(extracted.roe) || activeNote.roe,
        note: "",
        exchangeRates: { "USD": Number(extracted.roe) || activeNote.roe },
        charges: parsedCharges,
        createdAt: "",
      });

    } catch (err: any) {
      clearInterval(interval);
      console.error(err);
      setExtractError(err.message || "Đã xảy ra lỗi không xác định khi tải hoặc trích xuất tài liệu.");
    } finally {
      setIsExtracting(false);
    }
  };

  // Drag-and-drop support
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Action: Save active record to history Database
  const handleSaveDebitHistory = async () => {
    if (!activeNote.companyName.trim()) {
      alert("Hóa đơn phải đi kèm Tên khách hàng (TO)!");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activeNote),
      });

      if (!response.ok) {
        throw new Error("Không thể lưu hóa đơn.");
      }

      const resJson = await response.json();
      alert("Đã lưu trữ Debit Note thành công!");
      
      // Update local history lists
      fetchMasterData();
      
      // Bind exact ID back to avoid duplications on subsequent edits
      if (resJson.debitNote) {
        setActiveNote(resJson.debitNote);
      }
    } catch (err) {
      alert("Xảy ra lỗi khi lưu hóa đơn: " + err);
    } finally {
      setIsSaving(false);
    }
  };

  // Action: Select historic note to edit
  const handleSelectHistoryNote = (note: DebitNote) => {
    let volumeQty = note.volumeQty;
    let volumeUnit = note.volumeUnit;
    if (volumeQty === undefined || !volumeUnit) {
      const parsed = parseVolume(note.volume);
      volumeQty = parsed.qty;
      volumeUnit = parsed.unit;
    }
    setActiveNote({
      ...note,
      volumeQty,
      volumeUnit,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Action: Delete historic note
  const handleDeleteHistoryNote = async (id: string) => {
    try {
      const response = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      
      // If we deleted the active note, replace form with fresh values
      if (activeNote.id === id) {
        setActiveNote(createNewBlankDebitNote());
      }
      fetchMasterData();
    } catch (err) {
      alert("Không thể xóa bản ghi lịch sử này.");
    }
  };

  // Action: Manage Customer Add/Delete
  const handleAddMasterCustomer = async (cust: Customer) => {
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cust),
      });
      if (!response.ok) {
        let errMsg = "Lỗi không xác định";
        try {
           const errData = await response.json();
           errMsg = errData.error || errData.message || response.statusText;
        } catch(e) {}
        throw new Error(errMsg);
      }
      fetchMasterData();
    } catch (e: any) {
      alert("Không thể đồng bộ dữ liệu Khách hàng mới: " + e.message);
    }
  };

  const handleDeleteMasterCustomer = async (id: string) => {
    try {
      const response = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!response.ok) {
        let errMsg = "Lỗi không xác định";
        try {
           const errData = await response.json();
           errMsg = errData.error || errData.message || response.statusText;
        } catch(e) {}
        throw new Error(errMsg);
      }
      fetchMasterData();
    } catch (e: any) {
      alert("Thất bại khi xóa khách hàng: " + e.message);
    }
  };

  // Action: Manage Fee Add/Delete
  const handleAddMasterFee = async (fee: Fee) => {
    try {
      const response = await fetch("/api/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fee),
      });
      if (!response.ok) {
        let errMsg = "Lỗi không xác định";
        try {
           const errData = await response.json();
           errMsg = errData.error || errData.message || response.statusText;
        } catch(e) {}
        throw new Error(errMsg);
      }
      fetchMasterData();
    } catch (e: any) {
      alert("Không thể lưu loại phí mới vào database: " + e.message);
    }
  };

  const handleDeleteMasterFee = async (id: string) => {
    try {
      const response = await fetch(`/api/fees/${id}`, { method: "DELETE" });
      if (!response.ok) {
        let errMsg = "Lỗi không xác định";
        try {
           const errData = await response.json();
           errMsg = errData.error || errData.message || response.statusText;
        } catch(e) {}
        throw new Error(errMsg);
      }
      fetchMasterData();
    } catch (e: any) {
      alert("Thất bại khi xóa loại phí: " + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      
      {/* GLOBAL APPNET TOP BAR (Hidden when printing!) */}
      <header className="bg-slate-900 text-white shadow-sm border-b border-slate-800 print:hidden select-none shrink-0">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-md shadow-inner">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">LOGI-NOTE MANAGER</h1>
              <span className="text-[10px] text-emerald-400 font-bold block leading-none font-mono tracking-widest mt-0.5">
                VERSION 2.1 • A4 PRINT ENGINE
              </span>
            </div>
          </div>

          <div className="flex bg-slate-800 p-1.5 rounded-lg border border-slate-700 font-medium">
            <button
              onClick={() => setActiveTab("debit")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs transition cursor-pointer select-none ${
                activeTab === "debit" ? "bg-emerald-600 text-white shadow-xs font-bold" : "text-slate-300 hover:text-white"
              }`}
            >
              <FileText size={14} />
              Debit Note Layout
            </button>
            <button
              onClick={() => setActiveTab("data")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs transition cursor-pointer select-none ${
                activeTab === "data" ? "bg-emerald-600 text-white shadow-xs font-bold" : "text-slate-300 hover:text-white"
              }`}
            >
              <Database size={14} />
              Master Database (Danh mục)
            </button>
          </div>
        </div>
      </header>

      {/* CORE FRAMEWORK ELEMENT LAYOUTS */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 select-none print:p-0 print:m-0 print:max-w-none">
        
        {activeTab === "debit" ? (
          /* DEBIT NOTE VIEW TAB */
          <div className="space-y-6 print:block">
            
            {/* FILE UPLOAD DROPZONE AREA (Hidden when printing!) */}
            <div className="print:hidden">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-6 text-center transition ${
                  dragActive
                    ? "border-emerald-500 bg-emerald-50/50"
                    : "border-slate-300 bg-white hover:border-emerald-400 hover:bg-slate-50/40"
                }`}
              >
                <input
                  type="file"
                  id="doc-file-upload"
                  accept="application/pdf, image/*, .docx"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 bg-slate-100 rounded-full text-slate-500 group-hover:text-emerald-500 group-hover:bg-emerald-50 transition">
                    <Upload size={24} className="text-[#0a4d92]" />
                  </div>
                  <div className="text-sm">
                    <label
                      htmlFor="doc-file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-bold text-emerald-600 hover:text-emerald-700 focus-within:outline-none"
                    >
                      <span>Tải tài liệu lên để trích xuất</span>
                    </label>
                    <p className="text-slate-400 text-xs mt-1">
                      Hỗ trợ tệp <span className="font-semibold text-slate-500">PDF, Hình ảnh (PNG/JPG)</span>, hoặc tài liệu Word <span className="font-semibold text-slate-500">.DOCX</span>
                    </p>
                  </div>
                </div>

                {dragActive && (
                  <div className="absolute inset-0 bg-emerald-50 bg-opacity-70 flex items-center justify-center rounded-xl">
                    <span className="font-bold text-emerald-700 text-sm">Thả tệp của bạn tại đây...</span>
                  </div>
                )}
              </div>

              {/* Extraction Progress Loading Dialog */}
              {isExtracting && (
                <div className="mt-4 bg-[#f8fafc] border border-blue-100 rounded-lg p-5 flex items-center gap-4 animate-pulse">
                  <div className="shrink-0">
                    <RefreshCw className="animate-spin text-[#0a4d92]" size={24} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500 animate-bounce" />
                      Ý THỨC TRÍ TUỆ NHÂN TẠO GEMINI ĐANG CHẠY...
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 font-mono transition duration-300">
                      {extractProgressMessage}
                    </p>
                  </div>
                </div>
              )}

              {/* Error Display banner */}
              {extractError && (
                <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg flex items-start gap-2.5 text-xs">
                  <AlertTriangle size={16} className="text-rose-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">Lỗi trích xuất tệp:</span> {extractError}
                    <p className="mt-1 text-slate-500">Tài liệu của bạn có thể quá mờ hoặc định dạng không đúng chuẩn. Hãy tự điền bằng tay trực tiếp qua biểu mẫu chỉnh sửa bên dưới.</p>
                  </div>
                </div>
              )}
            </div>

            {/* MAIN COLUMN VIEWGRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print:block print:p-0 print:m-0">
              
              {/* SIDEBAR LỊCH SỬ (Hidden when printing!) */}
              <div className="col-span-1 lg:col-span-3 xl:col-span-2 print:hidden">
                <HistorySidebar
                  history={history}
                  onSelect={handleSelectHistoryNote}
                  onDelete={handleDeleteHistoryNote}
                  activeId={activeNote.id}
                />
              </div>

              {/* INTERACTIVE FORM EDITOR (Hidden when printing!) */}
              <div className="col-span-1 lg:col-span-9 xl:col-span-10 space-y-6 print:hidden">
                <DebitNoteForm
                  data={activeNote}
                  onChange={setActiveNote}
                  masterCustomers={customers}
                  masterFees={fees}
                  onAddFee={handleAddMasterFee}
                  onSave={handleSaveDebitHistory}
                  onReset={() => {
                    if (confirm("Xóa trắng tất cả dữ liệu đang soạn thảo để nhập biểu mẫu mới?")) {
                      setActiveNote(createNewBlankDebitNote());
                    }
                  }}
                  isSaving={isSaving}
                  onPreview={() => setIsPreviewOpen(true)}
                />
              </div>

              {/* High Fidelity Print-Only Container (Always present but hidden on screens) */}
              <div className="hidden print:block print:w-full print:m-0 print:p-0">
                <DebitNotePreview data={activeNote} />
              </div>

            </div>

            {/* PREVIEW & PRINT POPUP OVERLAY MODAL */}
            {isPreviewOpen && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto print:hidden">
                <div className="bg-slate-100 rounded-xl shadow-2xl relative max-w-[224mm] w-full max-h-[92vh] flex flex-col">
                  {/* Modal Header actions bar */}
                  <div className="bg-white px-6 py-4 rounded-t-xl border-b border-slate-200 flex items-center justify-between shrink-0">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">Xem trước & In mẫu Debit Note (A4)</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Vui lòng điều chỉnh định dạng lề máy in ở chế độ dọc (Portrait) khi in.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPreviewOpen(false)}
                      className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer transition duration-150 flex items-center justify-center"
                      title="Đóng"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Scroll Container carrying A4 render */}
                  <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-200/50 flex justify-center">
                    <div className="w-fit h-fit">
                      <DebitNotePreview data={activeNote} />
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : (
          /* MASTER DATA TAB VIEW */
          <div className="print:hidden">
            <MasterDataTab
              customers={customers}
              fees={fees}
              onAddCustomer={handleAddMasterCustomer}
              onDeleteCustomer={handleDeleteMasterCustomer}
              onAddFee={handleAddMasterFee}
              onDeleteFee={handleDeleteMasterFee}
            />
          </div>
        )}

      </main>

      {/* FOOTER METADATA BAR (Hidden when printing!) */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 text-center text-slate-500 text-[10px] print:hidden tracking-wider select-none shrink-0 font-mono mt-auto">
        <p>CƠ SỞ DỮ LIỆU ĐỒNG BỘ • CÔNG CỤ QUẢN LÝ DEBIT LOGISTICS CHUYÊN NGHIỆP • CUNG CẤP BỞI GOOGLE AI STUDIO BUILD</p>
      </footer>

    </div>
  );
}
