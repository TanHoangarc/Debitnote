import React, { useState } from "react";
import { DebitNote, ChargeItem, Customer, Fee } from "../types";
import { Calendar, Plus, Trash2, Save, Sparkles, RefreshCw, Layers, CheckSquare, Square, Eye, X, ChevronLeft, ChevronRight, Download } from "lucide-react";

interface DebitNoteFormProps {
  data: DebitNote;
  onChange: (updated: DebitNote) => void;
  masterCustomers: Customer[];
  masterFees: Fee[];
  onAddFee?: (fee: Fee) => void;
  onAddCustomer?: (customer: Customer) => void;
  onSave: () => void;
  onReset: () => void;
  isSaving: boolean;
  onPreview: () => void;
}

export default function DebitNoteForm({
  data,
  onChange,
  masterCustomers,
  masterFees,
  onAddFee,
  onAddCustomer,
  onSave,
  onReset,
  isSaving,
  onPreview,
}: DebitNoteFormProps) {
  // Local active inputs for adding custom charges
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState<string>("");
  const [isSearchingTax, setIsSearchingTax] = useState(false);

  // Quick Add Fee State
  const [showQuickAddFee, setShowQuickAddFee] = useState(false);
  const [quickAddRowIndex, setQuickAddRowIndex] = useState<number | null>(null);
  const [quickFeeDesc, setQuickFeeDesc] = useState("");
  const [quickFeeVat, setQuickFeeVat] = useState<number>(8);
  const [quickFeeIsPayBehalf, setQuickFeeIsPayBehalf] = useState(false);

  // Carrier State Hooks
  const [carrierList, setCarrierList] = useState<string[]>(() => {
    const saved = localStorage.getItem("carrier_list");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return ["MSC", "TSL", "YML", "COSCO", "ONE", "OOCL", "MAERSK", "CMA CGM", "WAN HAI", "EVERGREEN", "HAPAG-LLOYD", "HMM"];
  });
  const [showAddCarrierInput, setShowAddCarrierInput] = useState(false);
  const [newCarrierInput, setNewCarrierInput] = useState("");

  // Calendar Ref Code
  const dateInputRef = React.useRef<HTMLInputElement>(null);

  // Custom Datepicker State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (data.etdEta) {
      const parsed = Date.parse(data.etdEta);
      if (!isNaN(parsed)) {
        return new Date(parsed);
      }
    }
    return new Date();
  });

  const getDaysInMonthGrid = (viewDate: Date) => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // First day of current month
    const firstDay = new Date(year, month, 1);
    let startDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon...
    // Adjust Mon to index 0... Sun to index 6
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    // Days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Days in previous month
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const gridCells: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

    // Fill previous month trailing days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(year, month - 1, dayNum);
      gridCells.push({
        date: d,
        isCurrentMonth: false,
        key: `prev-${dayNum}`,
      });
    }

    // Fill current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      gridCells.push({
        date: d,
        isCurrentMonth: true,
        key: `curr-${i}`,
      });
    }

    // Fill next month leading days to complete 42 cells (6 rows of 7 days)
    const remaining = 42 - gridCells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      gridCells.push({
        date: d,
        isCurrentMonth: false,
        key: `next-${i}`,
      });
    }

    return gridCells;
  };

  const formatDateToISOString = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Exchange Rates Input State
  const [newCurrencyToRate, setNewCurrencyToRate] = useState("EUR");
  const [newRateValue, setNewRateValue] = useState("");

  const handleAddCarrier = () => {
    const val = newCarrierInput.trim().toUpperCase();
    if (val && !carrierList.includes(val)) {
      const updatedList = [...carrierList, val];
      setCarrierList(updatedList);
      localStorage.setItem("carrier_list", JSON.stringify(updatedList));
      onChange({
        ...data,
        carrierAgent: val,
      });
      setNewCarrierInput("");
      setShowAddCarrierInput(false);
    } else if (val) {
      onChange({
        ...data,
        carrierAgent: val,
      });
      setShowAddCarrierInput(false);
    }
  };

  const handleAddCustomRate = () => {
    const rateVal = Number(newRateValue) || 0;
    if (!rateVal) {
      alert("Vui lòng điền tỷ giá lớn hơn 0");
      return;
    }
    const currentRates = data.exchangeRates || { "USD": data.roe || 26400 };
    const updatedRates = {
      ...currentRates,
      [newCurrencyToRate]: rateVal,
    };
    onChange({
      ...data,
      exchangeRates: updatedRates,
      roe: newCurrencyToRate === "USD" ? rateVal : data.roe,
    });
    setNewRateValue("");
    
    // Auto-advance currency select to next unused one 
    const listCurrs = ["USD", "EUR", "JPY", "GBP", "CNY", "KRW", "SGD", "HKD", "AUD", "CAD"];
    const nextUnused = listCurrs.find((c) => !updatedRates[c]);
    if (nextUnused) {
      setNewCurrencyToRate(nextUnused);
    }
  };

  // Handler for text input change on parent elements
  const formatNum = (num: number, decimals: number = 0) => {
    if (isNaN(num) || num === null || num === undefined) return "0";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  const handleFieldChange = (field: keyof DebitNote, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  // Handler for selecting master customer to auto-fill details
  const handleSelectMasterCustomer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idxVal = e.target.value;
    setSelectedCustomerIndex(idxVal);
    if (idxVal !== "") {
      const cust = masterCustomers[Number(idxVal)];
      if (cust) {
        onChange({
          ...data,
          companyName: cust.name,
          taxId: cust.taxId,
          address: cust.address,
        });
      }
    }
  };

  // Update a specific charge row element
  const handleChargeRowChange = (index: number, field: keyof ChargeItem, value: any) => {
    const updatedCharges = [...data.charges];
    updatedCharges[index] = {
      ...updatedCharges[index],
      [field]: value,
    };
    onChange({
      ...data,
      charges: updatedCharges,
    });
  };

  // Insert fee template from master fee database
  const handleApplyFeeTemplate = (rowIndex: number, feeId: string) => {
    if (!feeId) return;
    const fee = masterFees.find((f) => f.id === feeId);
    if (fee) {
      const updatedCharges = [...data.charges];
      updatedCharges[rowIndex] = {
        ...updatedCharges[rowIndex],
        description: fee.description,
        vatPercent: fee.vatPercent,
        isPayOnBehalf: fee.isPayOnBehalf,
      };
      onChange({
        ...data,
        charges: updatedCharges,
      });
    }
  };

  // Action Save Quick Fee directly from select template matching
  const handleSaveQuickFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickFeeDesc.trim()) {
      alert("Vui lòng nhập tên loại phí!");
      return;
    }
    const cleanDesc = quickFeeDesc.trim().toUpperCase();

    // Check if description already exists in masterFees
    const existing = masterFees.find((f) => f.description.trim().toUpperCase() === cleanDesc);
    
    if (existing) {
      // Just apply the existing fee template
      if (quickAddRowIndex !== null) {
        const updatedCharges = [...data.charges];
        if (updatedCharges[quickAddRowIndex]) {
          updatedCharges[quickAddRowIndex] = {
            ...updatedCharges[quickAddRowIndex],
            description: existing.description,
            vatPercent: existing.vatPercent,
            isPayOnBehalf: existing.isPayOnBehalf,
          };
          onChange({
            ...data,
            charges: updatedCharges,
          });
        }
      }
    } else {
      const newId = "fee-" + Math.random().toString(36).substring(2, 9);
      const newFee: Fee = {
        id: newId,
        description: cleanDesc,
        vatPercent: quickFeeVat,
        isPayOnBehalf: quickFeeIsPayBehalf,
      };
      if (onAddFee) {
        await onAddFee(newFee);
      }
      
      // Apply this template to the row if row index was specified
      if (quickAddRowIndex !== null) {
        const updatedCharges = [...data.charges];
        if (updatedCharges[quickAddRowIndex]) {
          updatedCharges[quickAddRowIndex] = {
            ...updatedCharges[quickAddRowIndex],
            description: cleanDesc,
            vatPercent: quickFeeVat,
            isPayOnBehalf: quickFeeIsPayBehalf,
          };
          onChange({
            ...data,
            charges: updatedCharges,
          });
        }
      }
    }

    // Reset state & close modal
    setQuickFeeDesc("");
    setQuickFeeVat(8);
    setQuickFeeIsPayBehalf(false);
    setQuickAddRowIndex(null);
    setShowQuickAddFee(false);
  };

  // Add new free element row
  const handleAddChargeRow = () => {
    const defaultQty = data.volumeQty !== undefined ? data.volumeQty : 1.0;
    const newCharge: ChargeItem = {
      id: Math.random().toString(36).substring(2, 9),
      description: "",
      qty: defaultQty,
      price: 0,
      vatPercent: 0,
      currency: "VND",
      isPayOnBehalf: false,
    };
    onChange({
      ...data,
      charges: [...data.charges, newCharge],
    });
  };

  // Remove specific fee row
  const handleRemoveChargeRow = (index: number) => {
    const updatedCharges = data.charges.filter((_, i) => i !== index);
    onChange({
      ...data,
      charges: updatedCharges,
    });
  };

  // Sort charges: 0% VAT first, then 8%, then 10%, service fees (Chi hộ = false) before Chi hộ
  const handleAutoSortCharges = () => {
    const sorted = [...data.charges].sort((a, b) => {
      // 1. Phí dịch vụ (isPayOnBehalf == false) comes before Chi hộ (isPayOnBehalf == true)
      if (a.isPayOnBehalf !== b.isPayOnBehalf) {
        return a.isPayOnBehalf ? 1 : -1;
      }
      // 2. Sort by VAT (0, 8, 10...)
      const vatA = Number(a.vatPercent) || 0;
      const vatB = Number(b.vatPercent) || 0;
      return vatA - vatB;
    });
    onChange({
      ...data,
      charges: sorted,
    });
  };

  const handleSearchCompanyDetails = async () => {
    if (!data.companyName) {
      alert("Vui lòng nhập Tên công ty trước khi tra cứu.");
      return;
    }
    setIsSearchingTax(true);
    try {
      const res = await fetch(`/api/search-company`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: data.companyName })
      });
      if (!res.ok) {
        let errorMessage = "Thất bại khi liên hệ máy chủ tra cứu.";
        try {
          const errJson = await res.json();
          if (errJson && errJson.error) {
            errorMessage = errJson.error;
          }
        } catch (_) {}
        throw new Error(errorMessage);
      }
      const info = await res.json();
      
      if (info.taxId || info.address) {
        onChange({
          ...data,
          companyName: info.name || data.companyName,
          taxId: info.taxId || data.taxId,
          address: info.address || data.address
        });
        alert(`Đã tìm thấy thông tin công ty: \n${info.name || "-"}\nMST: ${info.taxId || "-"}\nĐịa chỉ: ${info.address || "-"}`);
      } else {
         alert("Không tìm thấy thông tin trên mạng, hãy kiểm tra lại tên công ty.");
      }
    } catch (e: any) {
      alert("Tra cứu thất bại: " + e.message);
    } finally {
      setIsSearchingTax(false);
    }
  };

  const handleSaveCustomerToMaster = () => {
    if (!data.companyName || !data.taxId) {
      alert("Vui lòng điền tối thiểu Tên công ty và Mã số thuế để lưu!");
      return;
    }
    if (onAddCustomer) {
      onAddCustomer({
        id: "",
        name: data.companyName,
        taxId: data.taxId,
        address: data.address,
      });
      alert(`Đã lưu "${data.companyName}" vào danh sách Khách hàng.`);
    }
  };

  const handleExportCSV = () => {
    if (!data.companyName) {
      alert("Vui lòng tối thiểu có Tên khách hàng để xuất dữ liệu.");
      return;
    }

    const rows = [];
    rows.push(["THÔNG TIN NỢ PHÍ / DEBIT NOTE CHI TIẾT"]);
    rows.push(["Mã Debit Note", data.id || "Mới (Chưa lưu)"]);
    rows.push(["Khách hàng (To)", data.companyName]);
    rows.push(["Mã số thuế (MST)", data.taxId || ""]);
    rows.push(["Địa chỉ (Address)", data.address || ""]);
    rows.push(["Mã Job (Job No)", data.jobNo || ""]);
    rows.push(["Hãng tàu/Đại lý (Carrier/Agent)", data.carrierAgent || ""]);
    rows.push(["Ngày tàu chạy/về (ETD/ETA)", data.etdEta || ""]);
    rows.push(["Số vận đơn (HBL/MBL)", data.hblMbl || ""]);
    rows.push(["Cảng bốc hàng (POL)", data.pol || ""]);
    rows.push(["Cảng dỡ hàng (POD)", data.pod || ""]);
    rows.push(["Số lượng vỏ xe/Cont (Volume)", data.volume || ""]);
    rows.push(["Tỷ giá quy đổi (ROE)", data.roe || ""]);
    rows.push(["Ghi chú (Note)", data.note || ""]);
    rows.push([]);

    rows.push([
      "STT",
      "Nội dung khoản phí (Description)",
      "Số lượng (Qty)",
      "Đơn giá (Price)",
      "Đơn vị (Currency)",
      "VAT (%)",
      "Thành tiền chưa VAT",
      "Tiền thuế VAT",
      "Thành tiền có VAT",
      "Quy đổi VND",
      "Hình thức"
    ]);

    let totalVnd = 0;
    data.charges.forEach((charge, index) => {
      const qty = Number(charge.qty) || 0;
      const price = Number(charge.price) || 0;
      const vatPct = Number(charge.vatPercent) || 0;
      const subtotal = qty * price;
      const vatVal = subtotal * (vatPct / 100);
      const inclVat = subtotal + vatVal;

      const rates = data.exchangeRates || (data.roe ? { "USD": data.roe } : {});
      const rate = charge.currency === "VND" ? 1 : (rates[charge.currency || "USD"] || 25000);
      const amountVnd = inclVat * rate;
      totalVnd += amountVnd;

      rows.push([
        index + 1,
        charge.description,
        qty,
        price,
        charge.currency,
        vatPct + "%",
        subtotal,
        vatVal,
        inclVat,
        Math.round(amountVnd),
        charge.isPayOnBehalf ? "CHI HỘ" : "DỊCH VỤ"
      ]);
    });

    rows.push([]);
    rows.push(["TỔNG QUY ĐỒI TỔNG THÀNH THANH TOÁN (VND)", "", "", "", "", "", "", "", "", Math.round(totalVnd)]);

    const csvContent = "\uFEFF" + rows.map(r => r.map(col => `"${String(col).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const safeName = data.companyName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    link.setAttribute("download", `DebitNote_${safeName || "Export"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-6">
      {/* Autocomplete Quickfill Panel */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
          ⚡ Chọn nhanh Khách hàng từ Database
        </label>
        <select
          value={selectedCustomerIndex}
          onChange={handleSelectMasterCustomer}
          className="w-full bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
        >
          <option value="">-- Click để chọn công ty và điền tự động --</option>
          {masterCustomers.map((cust, idx) => (
            <option key={cust.id} value={idx}>
              {cust.name} (MST: {cust.taxId})
            </option>
          ))}
        </select>
      </div>

      {/* Main Form Fields */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">
          <Layers size={18} className="text-emerald-600" />
          Thông tin Khách hàng & Hóa đơn
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8">
            <label className="block text-xs font-bold text-slate-600 mb-1 flex justify-between items-center">
              <span>TÊN CÔNG TY (CUSTOMER)</span>
              <button type="button" onClick={handleSaveCustomerToMaster} className="text-[10px] text-emerald-600 font-bold hover:underline cursor-pointer flex items-center gap-1">
                Lưu danh sách
              </button>
            </label>
            <input
              type="text"
              value={data.companyName}
              onChange={(e) => handleFieldChange("companyName", e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
              placeholder="Nhập tên đầy đủ công ty..."
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-slate-600 mb-1 flex justify-between">
              <span>MÃ SỐ THUẾ (MST)</span>
            </label>
            <div className="flex gap-1">
              <input
                type="text"
                value={data.taxId}
                onChange={(e) => handleFieldChange("taxId", e.target.value)}
                className="flex-1 min-w-0 bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-800 font-mono tracking-wider focus:ring-2 focus:ring-emerald-500"
                placeholder="Nhập MST..."
              />
              <button
                type="button"
                onClick={handleSearchCompanyDetails}
                disabled={isSearchingTax}
                className="bg-emerald-100 text-emerald-700 px-3 rounded-md text-xs font-bold flex items-center gap-1 hover:bg-emerald-200 disabled:opacity-50 transition cursor-pointer"
                title="Google Search Tra cứu MST & Địa chỉ tự động qua Tên công ty"
              >
                {isSearchingTax ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Tra cứu
              </button>
            </div>
          </div>

          <div className="md:col-span-12">
            <label className="block text-xs font-bold text-slate-600 mb-1">ĐỊA CHỈ (ADDRESS)</label>
            <input
              type="text"
              value={data.address}
              onChange={(e) => handleFieldChange("address", e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
              placeholder="Nhập địa chỉ đầy đủ..."
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-slate-600 mb-1">JOB NO.</label>
            <input
              type="text"
              value={data.jobNo}
              onChange={(e) => handleFieldChange("jobNo", e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-800 font-mono text-emerald-800 focus:ring-2 focus:ring-emerald-500"
              placeholder="VD: VNSGNFGD0011"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-slate-600 mb-1 flex justify-between items-center">
              <span>CARRIER / AGENT</span>
              {!showAddCarrierInput ? (
                <button
                  type="button"
                  onClick={() => setShowAddCarrierInput(true)}
                  className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-0.5 cursor-pointer"
                  title="Thêm Carrier mới"
                >
                  <Plus size={11} /> Thêm mới
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddCarrierInput(false)}
                  className="text-[10px] text-slate-500 hover:text-slate-600 font-bold cursor-pointer"
                >
                  Hủy
                </button>
              )}
            </label>
            {showAddCarrierInput ? (
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newCarrierInput}
                  onChange={(e) => setNewCarrierInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCarrier();
                    }
                  }}
                  className="flex-1 bg-white border border-emerald-300 rounded-md p-1.5 text-sm text-slate-800 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Nhập mã (ví dụ: ONE)..."
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddCarrier}
                  className="px-2.5 bg-emerald-600 text-white text-xs font-bold rounded-md hover:bg-emerald-700 transition flex items-center cursor-pointer"
                >
                  Lưu
                </button>
              </div>
            ) : (
              <select
                value={data.carrierAgent}
                onChange={(e) => handleFieldChange("carrierAgent", e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 cursor-pointer text-ellipsis"
              >
                <option value="">-- Chọn Hãng tàu / Đại lý --</option>
                {carrierList.map((carrier) => (
                  <option key={carrier} value={carrier}>
                    {carrier}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="md:col-span-4 relative">
            <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center justify-between">
              <span>ETD / ETA DATE</span>
              <span className="text-[10px] text-emerald-600 font-semibold cursor-pointer" onClick={() => setShowDatePicker(!showDatePicker)}>Sử dụng lịch kế bên</span>
            </label>
            <div className="relative flex items-center">
              <input
                ref={dateInputRef}
                type="text"
                value={data.etdEta}
                onChange={(e) => handleFieldChange("etdEta", e.target.value)}
                onFocus={() => setShowDatePicker(true)}
                className="w-full bg-white border border-slate-300 rounded-md p-2 pr-10 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 font-mono"
                placeholder="YYYY-MM-DD"
              />
              <button
                type="button"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer flex items-center justify-center p-1 rounded hover:bg-slate-50 transition"
                title="Chọn ngày"
              >
                <Calendar size={16} />
              </button>
            </div>

            {showDatePicker && (
              <>
                {/* Overlay/backdrop to close the dropdown */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowDatePicker(false)} 
                />
                <div className="absolute top-[100%] left-0 right-0 mt-1.5 z-50 bg-white border border-slate-300 shadow-2xl rounded-lg p-3 w-72 max-w-full animate-in fade-in duration-100">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                    <button
                      type="button"
                      onClick={() => {
                        const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
                        setCurrentMonth(prev);
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600 cursor-pointer transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold text-slate-800">
                      Tháng {currentMonth.getMonth() + 1}, {currentMonth.getFullYear()}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
                        setCurrentMonth(next);
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600 cursor-pointer transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  
                  {/* Grid Header for Days of Week */}
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-2">
                    <span>T2</span>
                    <span>T3</span>
                    <span>T4</span>
                    <span>T5</span>
                    <span>T6</span>
                    <span>T7</span>
                    <span className="text-rose-500">CN</span>
                  </div>

                  {/* Grid for Monthly Days */}
                  <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    {getDaysInMonthGrid(currentMonth).map((cell) => {
                      const dateStr = formatDateToISOString(cell.date);
                      const isSelected = data.etdEta === dateStr;
                      return (
                        <button
                          key={cell.key}
                          type="button"
                          onClick={() => {
                            handleFieldChange("etdEta", dateStr);
                            setShowDatePicker(false);
                          }}
                          className={`
                            h-7 w-7 mx-auto flex items-center justify-center rounded-md cursor-pointer transition-all text-xs font-medium
                            ${cell.isCurrentMonth ? "text-slate-800" : "text-slate-300"}
                            ${isSelected
                              ? "bg-slate-800 text-white font-bold scale-110 shadow-md shadow-slate-200" 
                              : "hover:bg-slate-100/85"
                            }
                          `}
                        >
                          {cell.date.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick select presets */}
                  <div className="border-t border-slate-150 mt-3 pt-2.5 flex justify-between items-center text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        const todayStr = formatDateToISOString(today);
                        handleFieldChange("etdEta", todayStr);
                        setCurrentMonth(today);
                        setShowDatePicker(false);
                      }}
                      className="text-emerald-700 font-bold hover:underline cursor-pointer"
                    >
                      Hôm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDatePicker(false);
                      }}
                      className="text-slate-500 hover:text-slate-700 font-bold cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-slate-600 mb-1">HBL / MBL (BILL NO)</label>
            <input
              type="text"
              value={data.hblMbl}
              onChange={(e) => handleFieldChange("hblMbl", e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-800 font-mono focus:ring-2 focus:ring-emerald-500"
              placeholder="Ưu tiên số HBL..."
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1">CẢNG ĐI (P.O.L)</label>
            <input
              type="text"
              value={data.pol}
              onChange={(e) => handleFieldChange("pol", e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
              placeholder="VD: HCM"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1">CẢNG ĐẾN (P.O.D)</label>
            <input
              type="text"
              value={data.pod}
              onChange={(e) => handleFieldChange("pod", e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
              placeholder="VD: TPP, HPG"
            />
          </div>

          <div className="md:col-span-4 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">VOLUME SL (QTY)</label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={data.volumeQty !== undefined ? data.volumeQty : ""}
                onChange={(e) => {
                  const rawVal = e.target.value;
                  const val = rawVal === "" ? undefined : (parseFloat(rawVal) || 0);
                  const currentUnit = data.volumeUnit || "";
                  
                  // Automatically link with service fee table quantities
                  const updatedCharges = data.charges.map((charge) => ({
                    ...charge,
                    qty: val !== undefined ? val : 1,
                  }));
                  
                  onChange({
                    ...data,
                    volumeQty: val,
                    volume: val !== undefined ? (currentUnit ? `${val} X ${currentUnit}` : `${val}`) : `${currentUnit}`,
                    charges: updatedCharges,
                  });
                }}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-sm font-semibold text-slate-800 font-mono focus:ring-2 focus:ring-emerald-500"
                placeholder="Số lượng..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">LOẠI CONT (TYPE)</label>
              <select
                value={data.volumeUnit || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  const currentQty = data.volumeQty;
                  onChange({
                    ...data,
                    volumeUnit: val,
                    volume: currentQty !== undefined ? (val ? `${currentQty} X ${val}` : `${currentQty}`) : val,
                  });
                }}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 cursor-pointer font-bold text-slate-700"
              >
                {["", "20GP", "40GP", "40HQ", "45HQ", "20RF", "40RF", "CBM", "KGS"].map((unit) => (
                  <option key={unit} value={unit}>
                    {unit === "" ? "-- Trống / Blank --" : unit}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="md:col-span-4 bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-700">TỶ GIÁ QUY ĐỔI CO-CURRENCY (R.O.E)</label>
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
              {Object.entries(data.exchangeRates ? data.exchangeRates : (data.roe ? { "USD": data.roe } : {})).map(([currency, rate]) => (
                <div key={currency} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 font-bold text-slate-600 text-center text-xs py-1.5 px-1.5 bg-white border border-slate-300 rounded animate-fade-in truncate h-8 flex items-center justify-center uppercase">
                    {currency}
                  </span>
                  <input
                    type="number"
                    value={rate}
                    onChange={(e) => {
                      const newRate = Number(e.target.value) || 0;
                      const baseRates = data.exchangeRates ? data.exchangeRates : (data.roe ? { "USD": data.roe } : {});
                      const updatedRates = { ...baseRates, [currency]: newRate };
                      onChange({
                        ...data,
                        roe: currency === "USD" ? newRate : data.roe,
                        exchangeRates: updatedRates,
                      });
                    }}
                    className="flex-1 min-w-0 bg-white border border-slate-300 rounded p-1 text-xs text-slate-800 font-mono focus:ring-1 focus:ring-emerald-500 h-8"
                    placeholder="Nhập tỷ giá..."
                  />
                  {currency !== "USD" ? (
                    <button
                      type="button"
                      onClick={() => {
                        const baseRates = data.exchangeRates ? data.exchangeRates : (data.roe ? { "USD": data.roe } : {});
                        const updatedRates = { ...baseRates };
                        delete updatedRates[currency];
                        onChange({
                          ...data,
                          exchangeRates: updatedRates,
                        });
                      }}
                      className="text-slate-400 hover:text-rose-500 p-1.5 cursor-pointer flex items-center justify-center rounded hover:bg-rose-50 w-8 h-8 transition-colors shrink-0 border border-transparent hover:border-rose-100"
                      title={`Xóa tỷ giá ${currency}`}
                    >
                      <X size={14} />
                    </button>
                  ) : (
                    <div className="w-8 h-8 shrink-0"></div>
                  )}
                </div>
              ))}
            </div>

            {/* Inline custom currency / rate adder */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <select
                value={newCurrencyToRate}
                onChange={(e) => setNewCurrencyToRate(e.target.value)}
                className="w-16 bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-700 cursor-pointer h-8 shrink-0 font-bold"
              >
                {["EUR", "USD", "JPY", "GBP", "CNY", "KRW", "SGD", "HKD", "AUD", "CAD"].map((curr) => {
                  const activeRates = data.exchangeRates ? data.exchangeRates : (data.roe ? { "USD": data.roe } : {});
                  return (
                    <option key={curr} value={curr} disabled={!!activeRates[curr]}>
                      {curr}
                    </option>
                  );
                })}
              </select>
              <input
                type="number"
                value={newRateValue}
                onChange={(e) => setNewRateValue(e.target.value)}
                placeholder="Tỷ giá..."
                className="flex-1 min-w-0 bg-white border border-slate-300 rounded p-1 text-xs text-slate-800 font-mono h-8"
              />
              <button
                type="button"
                onClick={handleAddCustomRate}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded p-1.5 font-bold text-xs flex items-center justify-center cursor-pointer h-8 w-8 shrink-0 transition-colors border border-emerald-600"
                title="Thêm tỷ giá"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="md:col-span-8 flex flex-col justify-between">
            <div className="h-full flex flex-col">
              <label className="block text-xs font-bold text-slate-600 mb-1">GHI CHÚ HÓA ĐƠN (NOTE)</label>
              <textarea
                value={data.note}
                onChange={(e) => handleFieldChange("note", e.target.value)}
                className="w-full flex-1 bg-white border border-slate-300 rounded-md p-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 min-h-[100px] resize-none"
                placeholder="Nhập ghi chú tùy ý (để trống nếu không muốn điền)..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Charges & Fee Rows Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Layers size={18} className="text-emerald-600" />
            Bảng cước phí dịch vụ & Chi hộ
          </h3>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoSortCharges}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded transition font-medium cursor-pointer"
              title="Ưu tiên sắp xếp các phí có VAT 0% lên trên"
            >
              <RefreshCw size={12} />
              Sắp xếp theo VAT
            </button>
            <button
              type="button"
              onClick={handleAddChargeRow}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded transition font-bold cursor-pointer"
            >
              <Plus size={12} />
              Thêm dòng phí
            </button>
          </div>
        </div>

        {/* Dense Table Grid Editor */}
        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left text-xs border-collapse divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
              <tr className="divide-x divide-slate-200">
                <th className="p-2 w-[180px]">Mẫu phí DB</th>
                <th className="p-2 w-[150px]">TÊN PHÍ (DESCRIPTION)</th>
                <th className="p-2 w-[70px]">SỐ LƯỢNG (QTY)</th>
                <th className="p-2 w-[90px]">ĐƠN GIÁ (PRICE)</th>
                <th className="p-2 w-[65px]">VAT %</th>
                <th className="p-2 w-[75px]">TIỀN TỆ</th>
                <th className="p-2 w-[110px] text-right">SỐ TIỀN (VND)</th>
                <th className="p-2 w-[65px] text-center">CHI HỘ</th>
                <th className="p-2 w-[50px] text-center">XÓA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-800 bg-white">
              {data.charges.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-slate-400 italic">
                    Chưa có phí nào. Nhấp "Thêm dòng phí" hoặc tải tài liệu lên để trích xuất tự động!
                  </td>
                </tr>
              ) : (
                <>
                  {/* Category A: LOGISTICS CHARGES */}
                  <tr className="bg-slate-100/80 text-slate-800 font-bold border-y border-slate-200">
                    <td colSpan={9} className="p-2 text-left uppercase tracking-wider text-[11px] font-black text-blue-900 bg-slate-100 select-none">
                      LOGISTICS CHARGE (PHÍ DỊCH VỤ)
                    </td>
                  </tr>
                  {data.charges.filter(c => !c.isPayOnBehalf).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-2.5 text-center text-slate-400 italic bg-white select-none">
                        Chưa có phí dịch vụ nào.
                      </td>
                    </tr>
                  ) : (
                    data.charges.map((charge, rowIndex) => {
                      if (charge.isPayOnBehalf) return null;
                      return (
                        <tr key={charge.id} className="divide-x divide-slate-100 align-middle">
                          {/* Database Fee Match Template picker */}
                          <td className="p-1">
                            {(() => {
                              const matchingFee = masterFees.find(
                                (fee) => fee.description.trim().toUpperCase() === charge.description.trim().toUpperCase()
                              );
                              const selectValue = matchingFee ? matchingFee.id : "";
                              return (
                                <div className="flex items-center gap-1">
                                  <select
                                    value={selectValue}
                                    onChange={(e) => handleApplyFeeTemplate(rowIndex, e.target.value)}
                                    className={`flex-1 min-w-0 border rounded p-1 text-[11px] font-sans font-semibold focus:outline-none transition-colors ${
                                      selectValue
                                        ? "bg-blue-50 border-blue-200 text-blue-600 focus:border-blue-400 font-bold"
                                        : "bg-slate-50/50 border-slate-200 text-slate-500 focus:border-slate-400"
                                    }`}
                                  >
                                    <option value="" className="text-slate-500">-- Mẫu phí DB --</option>
                                    {masterFees.map((fee) => (
                                      <option key={fee.id} value={fee.id} className="text-slate-850 font-semibold text-xs text-slate-900 bg-white">
                                        {fee.description} ({fee.vatPercent}% {fee.isPayOnBehalf ? "[Chi hộ]" : ""})
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuickAddRowIndex(rowIndex);
                                      setShowQuickAddFee(true);
                                    }}
                                    className="p-1 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 hover:text-emerald-700 rounded transition cursor-pointer shrink-0"
                                    title="Thêm nhanh loại phí mới vào tủ hàng hóa"
                                  >
                                    <Plus size={11} />
                                  </button>
                                </div>
                              );
                            })()}
                          </td>

                          {/* Description Text Input */}
                          <td className="p-1">
                            <input
                              type="text"
                              value={charge.description}
                              onChange={(e) => handleChargeRowChange(rowIndex, "description", e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded p-1 font-bold text-slate-800"
                              placeholder="Tên phí..."
                            />
                          </td>

                          {/* Qty Input */}
                          <td className="p-1">
                            <input
                              type="number"
                              step="any"
                              value={charge.qty}
                              onChange={(e) => handleChargeRowChange(rowIndex, "qty", parseFloat(e.target.value) || 0)}
                              className="w-full bg-white border border-slate-200 rounded p-1 pr-1 font-mono text-center"
                            />
                          </td>

                          {/* Price Input */}
                          <td className="p-1">
                            <input
                              type="number"
                              step="any"
                              value={charge.price}
                              onChange={(e) => handleChargeRowChange(rowIndex, "price", parseFloat(e.target.value) || 0)}
                              className="w-full bg-white border border-slate-200 rounded p-1 text-right font-mono"
                            />
                          </td>

                          {/* VAT Selector */}
                          <td className="p-1">
                            <select
                              value={charge.vatPercent}
                              onChange={(e) => handleChargeRowChange(rowIndex, "vatPercent", Number(e.target.value))}
                              className="w-full bg-white border border-slate-200 rounded p-1 font-semibold"
                            >
                              <option value={0}>0 %</option>
                              <option value={8}>8 %</option>
                              <option value={10}>10 %</option>
                            </select>
                          </td>

                          {/* Currency Selector */}
                          <td className="p-1">
                            <select
                              value={charge.currency}
                              onChange={(e) => handleChargeRowChange(rowIndex, "currency", e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded p-1 font-semibold text-slate-600 text-center"
                            >
                              <option value="VND">VND</option>
                              <option value="USD">USD</option>
                              <option value="EUR">EURO (EUR)</option>
                              <option value="GBP">GBP</option>
                            </select>
                          </td>

                          {/* VND Amount Column */}
                          <td className="p-1 text-right font-mono font-bold text-blue-700 bg-slate-50/50 pr-2 select-all overflow-hidden truncate max-w-[110px]">
                            {(() => {
                              const qty = charge.qty || 0;
                              const price = charge.price || 0;
                              const vatPct = charge.vatPercent || 0;
                              const subtotal = qty * price;
                              const vatAmount = subtotal * (vatPct / 100);
                              const inclVat = subtotal + vatAmount;

                              const rates = data.exchangeRates || (data.roe ? { "USD": data.roe } : {});
                              const rate = charge.currency === "VND" ? 1 : (rates[charge.currency || "USD"] || 25000);
                              const amountVnd = inclVat * rate;
                              return formatNum(amountVnd, 0);
                            })()}
                          </td>

                          {/* Chi hộ checkbox (moves down and changes grouping) */}
                          <td className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleChargeRowChange(rowIndex, "isPayOnBehalf", !charge.isPayOnBehalf)}
                              className="inline-flex items-center justify-center p-1 rounded-sm text-slate-500 hover:bg-slate-100 transition cursor-pointer"
                              title={charge.isPayOnBehalf ? "Đang xếp vào mục: CHI HỘ" : "Đang xếp vào mục: PHÍ DỊCH VỤ"}
                            >
                              {charge.isPayOnBehalf ? (
                                <CheckSquare size={16} className="text-amber-600 fill-amber-50" />
                              ) : (
                                <Square size={16} className="text-slate-300" />
                              )}
                            </button>
                          </td>

                          {/* Delete Handler Button */}
                          <td className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveChargeRow(rowIndex)}
                              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded transition cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* Category B: PAY ON BEHALF CHARGES */}
                  <tr className="bg-amber-50/50 text-slate-850 font-bold border-y border-amber-200">
                    <td colSpan={9} className="p-2 text-left uppercase tracking-wider text-[11px] font-black text-amber-850 bg-amber-50 select-none">
                      PAY ON BEHALF (CHI HỘ)
                    </td>
                  </tr>
                  {data.charges.filter(c => c.isPayOnBehalf).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-2.5 text-center text-slate-400 italic bg-white select-none">
                        Chưa có chi hộ/chi phí hộ nào.
                      </td>
                    </tr>
                  ) : (
                    data.charges.map((charge, rowIndex) => {
                      if (!charge.isPayOnBehalf) return null;
                      return (
                        <tr key={charge.id} className="divide-x divide-slate-100 align-middle">
                          {/* Database Fee Match Template picker */}
                          <td className="p-1">
                            {(() => {
                              const matchingFee = masterFees.find(
                                (fee) => fee.description.trim().toUpperCase() === charge.description.trim().toUpperCase()
                              );
                              const selectValue = matchingFee ? matchingFee.id : "";
                              return (
                                <div className="flex items-center gap-1">
                                  <select
                                    value={selectValue}
                                    onChange={(e) => handleApplyFeeTemplate(rowIndex, e.target.value)}
                                    className={`flex-1 min-w-0 border rounded p-1 text-[11px] font-sans font-semibold focus:outline-none transition-colors ${
                                      selectValue
                                        ? "bg-amber-50 border-amber-200 text-amber-700 focus:border-amber-400 font-bold"
                                        : "bg-slate-50/50 border-slate-200 text-slate-500 focus:border-slate-400"
                                    }`}
                                  >
                                    <option value="" className="text-slate-500">-- Mẫu phí DB --</option>
                                    {masterFees.map((fee) => (
                                      <option key={fee.id} value={fee.id} className="text-slate-850 font-semibold text-xs text-slate-900 bg-white">
                                        {fee.description} ({fee.vatPercent}% {fee.isPayOnBehalf ? "[Chi hộ]" : ""})
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuickAddRowIndex(rowIndex);
                                      setShowQuickAddFee(true);
                                    }}
                                    className="p-1 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 hover:text-emerald-700 rounded transition cursor-pointer shrink-0"
                                    title="Thêm nhanh loại phí mới vào tủ hàng hóa"
                                  >
                                    <Plus size={11} />
                                  </button>
                                </div>
                              );
                            })()}
                          </td>

                          {/* Description Text Input */}
                          <td className="p-1">
                            <input
                              type="text"
                              value={charge.description}
                              onChange={(e) => handleChargeRowChange(rowIndex, "description", e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded p-1 font-bold text-amber-900"
                              placeholder="Tên phí..."
                            />
                          </td>

                          {/* Qty Input */}
                          <td className="p-1">
                            <input
                              type="number"
                              step="any"
                              value={charge.qty}
                              onChange={(e) => handleChargeRowChange(rowIndex, "qty", parseFloat(e.target.value) || 0)}
                              className="w-full bg-white border border-slate-200 rounded p-1 pr-1 font-mono text-center"
                            />
                          </td>

                          {/* Price Input */}
                          <td className="p-1">
                            <input
                              type="number"
                              step="any"
                              value={charge.price}
                              onChange={(e) => handleChargeRowChange(rowIndex, "price", parseFloat(e.target.value) || 0)}
                              className="w-full bg-white border border-slate-200 rounded p-1 text-right font-mono text-amber-950"
                            />
                          </td>

                          {/* VAT Selector */}
                          <td className="p-1">
                            <select
                              value={charge.vatPercent}
                              onChange={(e) => handleChargeRowChange(rowIndex, "vatPercent", Number(e.target.value))}
                              className="w-full bg-white border border-slate-200 rounded p-1 font-semibold text-amber-900"
                            >
                              <option value={0}>0 %</option>
                              <option value={8}>8 %</option>
                              <option value={10}>10 %</option>
                            </select>
                          </td>

                          {/* Currency Selector */}
                          <td className="p-1">
                            <select
                              value={charge.currency}
                              onChange={(e) => handleChargeRowChange(rowIndex, "currency", e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded p-1 font-semibold text-amber-900 text-center"
                            >
                              <option value="VND">VND</option>
                              <option value="USD">USD</option>
                              <option value="EUR">EURO (EUR)</option>
                              <option value="GBP">GBP</option>
                            </select>
                          </td>

                          {/* VND Amount Column */}
                          <td className="p-1 text-right font-mono font-bold text-amber-700 bg-amber-50/30 pr-2 select-all overflow-hidden truncate max-w-[110px]">
                            {(() => {
                              const qty = charge.qty || 0;
                              const price = charge.price || 0;
                              const vatPct = charge.vatPercent || 0;
                              const subtotal = qty * price;
                              const vatAmount = subtotal * (vatPct / 100);
                              const inclVat = subtotal + vatAmount;

                              const rates = data.exchangeRates || (data.roe ? { "USD": data.roe } : {});
                              const rate = charge.currency === "VND" ? 1 : (rates[charge.currency || "USD"] || 25000);
                              const amountVnd = inclVat * rate;
                              return formatNum(amountVnd, 0);
                            })()}
                          </td>

                          {/* Chi hộ checkbox (moves down and changes grouping) */}
                          <td className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleChargeRowChange(rowIndex, "isPayOnBehalf", !charge.isPayOnBehalf)}
                              className="inline-flex items-center justify-center p-1 rounded-sm text-slate-500 hover:bg-slate-100 transition cursor-pointer"
                              title={charge.isPayOnBehalf ? "Đang xếp vào mục: CHI HỘ" : "Đang xếp vào mục: PHÍ DỊCH VỤ"}
                            >
                              {charge.isPayOnBehalf ? (
                                <CheckSquare size={16} className="text-amber-600 fill-amber-50" />
                              ) : (
                                <Square size={16} className="text-slate-300" />
                              )}
                            </button>
                          </td>

                          {/* Delete Handler Button */}
                          <td className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveChargeRow(rowIndex)}
                              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded transition cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </>
              )}

              {/* GRAND TOTAL SUMMARY ROW */}
              {data.charges.length > 0 && (
                <tr className="bg-slate-50 text-slate-900 border-t border-slate-200 divide-x divide-slate-100 font-semibold select-none">
                  <td colSpan={6} className="p-2.5 text-right uppercase text-[10px] tracking-wider text-slate-500 font-bold pr-3">
                    TỔNG CỘNG QUY ĐỒI TẠM TÍNH (VND):
                  </td>
                  <td className="p-2 text-right pr-2 font-mono font-black text-blue-800 text-[13px] bg-blue-50/50">
                    {(() => {
                      let totalVnd = 0;
                      data.charges.forEach((charge) => {
                        const qty = charge.qty || 0;
                        const price = charge.price || 0;
                        const vatPct = charge.vatPercent || 0;
                        const subtotal = qty * price;
                        const vatAmount = subtotal * (vatPct / 100);
                        const inclVat = subtotal + vatAmount;

                        const rates = data.exchangeRates || (data.roe ? { "USD": data.roe } : {});
                        const rate = charge.currency === "VND" ? 1 : (rates[charge.currency || "USD"] || 25000);
                        totalVnd += inclVat * rate;
                      });
                      return formatNum(totalVnd, 0) + " VND";
                    })()}
                  </td>
                  <td colSpan={2} className="bg-slate-50"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Footer Drawer buttons */}
      <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-medium rounded transition cursor-pointer text-center"
        >
          Xóa trắng biểu mẫu (Reset)
        </button>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm px-4 py-2 transition shadow-sm cursor-pointer"
            title="Xuất bảng chi phí nợ phí chi tiết sang tệp CSV/Excel"
          >
            <Download size={16} />
            Xuất Excel (CSV)
          </button>

          <button
            type="button"
            onClick={onPreview}
            className="flex items-center justify-center gap-2 rounded bg-[#0a4d92] hover:bg-[#073a6e] text-white font-bold text-sm px-4 py-2 transition shadow-sm cursor-pointer"
          >
            <Eye size={16} />
            Xem trước & In (A4 PDF)
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-1 rounded bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold text-sm px-4 py-2 transition shadow-sm cursor-pointer"
          >
            <Save size={16} />
            {isSaving ? "Đang xử lý..." : "Lưu vào Lịch sử"}
          </button>
        </div>
      </div>

      {/* QUICK ADD MASTER FEE MODAL POPUP */}
      {showQuickAddFee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm border border-slate-200 divide-y divide-slate-100 overflow-hidden animate-fade-in">
            <div className="px-4 py-3 bg-slate-50 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 text-emerald-600">
                <Plus size={14} />
                Thêm nhanh loại phí mới vào tủ
              </h3>
              <button
                type="button"
                onClick={() => {
                  setQuickAddRowIndex(null);
                  setShowQuickAddFee(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveQuickFee} className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Tên Loại Phí *</label>
                <input
                  type="text"
                  value={quickFeeDesc}
                  onChange={(e) => setQuickFeeDesc(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-xs text-slate-800 uppercase font-black placeholder:normal-case font-bold"
                  placeholder="Vd: PHÍ D/O, STORAGE, LIFT ON/OFF..."
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">VAT %</label>
                  <select
                    value={quickFeeVat}
                    onChange={(e) => setQuickFeeVat(Number(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 font-bold select-none cursor-pointer"
                  >
                    <option value={0}>0 %</option>
                    <option value={8}>8 %</option>
                    <option value={10}>10 %</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Hình thức phí</label>
                  <div className="flex items-center h-[34px] select-none">
                    <input
                      type="checkbox"
                      id="quick-pay-behalf-chk"
                      checked={quickFeeIsPayBehalf}
                      onChange={(e) => setQuickFeeIsPayBehalf(e.target.checked)}
                      className="rounded text-emerald-600 border-slate-300 h-3.5 w-3.5 mr-1 cursor-pointer"
                    />
                    <label htmlFor="quick-pay-behalf-chk" className="text-[11px] font-bold text-slate-600 cursor-pointer">
                      Chi hộ
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddRowIndex(null);
                    setShowQuickAddFee(false);
                  }}
                  className="px-3 py-1.5 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded transition cursor-pointer"
                >
                  Lưu & Áp Dụng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
