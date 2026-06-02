import React, { useState } from "react";
import { Customer, Fee } from "../types";
import { Plus, Trash2, Edit3, CheckCircle2, UserCheck, Receipt, Globe, Search, Clipboard, X, Check } from "lucide-react";

interface MasterDataTabProps {
  customers: Customer[];
  fees: Fee[];
  onAddCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onAddFee: (fee: Fee) => void;
  onDeleteFee: (id: string) => void;
}

export default function MasterDataTab({
  customers,
  fees,
  onAddCustomer,
  onDeleteCustomer,
  onAddFee,
  onDeleteFee,
}: MasterDataTabProps) {
  // Customers Forms State
  const [custName, setCustName] = useState("");
  const [custTaxId, setCustTaxId] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custSearch, setCustSearch] = useState("");

  // Fees Forms State
  const [feeDesc, setFeeDesc] = useState("");
  const [feeVat, setFeeVat] = useState<number>(8); // Default 8% VAT
  const [feeIsPayBehalf, setFeeIsPayBehalf] = useState(false);
  const [feeSearch, setFeeSearch] = useState("");

  // Rowan Active editing state for fees
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [editFeeDesc, setEditFeeDesc] = useState("");
  const [editFeeVat, setEditFeeVat] = useState<number>(8);
  const [editFeeIsPayBehalf, setEditFeeIsPayBehalf] = useState(false);

  const handleSaveEditFee = (feeId: string) => {
    if (!editFeeDesc.trim()) {
      alert("Vui lòng điền tên loại phí!");
      return;
    }
    const updatedFee: Fee = {
      id: feeId,
      description: editFeeDesc.trim().toUpperCase(),
      vatPercent: editFeeVat,
      isPayOnBehalf: editFeeIsPayBehalf,
    };
    onAddFee(updatedFee);
    setEditingFeeId(null);
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custTaxId.trim()) {
      alert("Vui lòng nhập tên công ty và mã số thuế!");
      return;
    }
    const newCust: Customer = {
      id: Math.random().toString(36).substring(2, 9),
      name: custName.trim(),
      taxId: custTaxId.trim().replace(/\s+/g, ""), // clean spacing
      address: custAddress.trim() || "Chưa cập nhật địa chỉ",
    };
    onAddCustomer(newCust);
    // Reset Form
    setCustName("");
    setCustTaxId("");
    setCustAddress("");
  };

  const handleCreateFee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeDesc.trim()) {
      alert("Vui lòng điền tên loại phí!");
      return;
    }
    const newFee: Fee = {
      id: Math.random().toString(36).substring(2, 9),
      description: feeDesc.trim().toUpperCase(),
      vatPercent: Number(feeVat) || 0,
      isPayOnBehalf: feeIsPayBehalf,
    };
    onAddFee(newFee);
    // Reset Form
    setFeeDesc("");
    setFeeVat(8);
    setFeeIsPayBehalf(false);
  };

  // Filters
  const filteredCustomers = customers.filter((c) => {
    const term = custSearch.toLowerCase();
    return c.name.toLowerCase().includes(term) || c.taxId.includes(term);
  });

  const filteredFees = fees.filter((f) => {
    const term = feeSearch.toLowerCase();
    return f.description.toLowerCase().includes(term);
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pb-12 select-text">
      {/* 1. MASTER CUSTOMER SECTION */}
      <div className="xl:col-span-7 bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col space-y-4">
        <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
          <UserCheck className="text-emerald-600" size={18} />
          Danh sách Khách hàng (Customers Database)
        </h3>

        {/* Create Customer Inline Card */}
        <form onSubmit={handleCreateCustomer} className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3">
          <h4 className="col-span-1 md:col-span-2 text-xs font-bold uppercase text-slate-500 flex items-center gap-1">
            <Plus size={14} /> Thêm khách hàng mới
          </h4>

          <div className="col-span-1 md:col-span-2">
            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">TÊN CÔNG TY</label>
            <input
              type="text"
              required
              value={custName}
              onChange={(e) => setCustName(e.target.value)}
              placeholder="Nhập tên Công ty đầy đủ..."
              className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">MÃ SỐ THUẾ (MST)</label>
            <input
              type="text"
              required
              value={custTaxId}
              onChange={(e) => setCustTaxId(e.target.value)}
              placeholder="Ví dụ: 0313579635"
              className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">ĐỊA CHỈ (ADDRESS)</label>
            <input
              type="text"
              value={custAddress}
              onChange={(e) => setCustAddress(e.target.value)}
              placeholder="Nhập địa chỉ đăng ký kinh doanh..."
              className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="col-span-1 md:col-span-2 flex justify-end mt-1">
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-xs py-1.5 px-3 flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <CheckCircle2 size={13} /> Lưu Khách hàng
            </button>
          </div>
        </form>

        {/* Customer Listing Section */}
        <div className="space-y-2">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={custSearch}
              onChange={(e) => setCustSearch(e.target.value)}
              placeholder="Lọc danh sách khách hàng..."
              className="w-full text-xs bg-white border border-slate-300 rounded p-2 pl-8 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          </div>

          {/* Customer Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-[#f8fafc] text-[#0a4d92] font-semibold border-b border-slate-200 text-[10px] uppercase">
                <tr>
                  <th className="p-3 w-2/5">Tên Công Ty</th>
                  <th className="p-3 w-1/5">MST</th>
                  <th className="p-3 w-2/5">Địa Chỉ</th>
                  <th className="p-3 w-12 text-center text-slate-400">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                      Danh sách khách hàng trống.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-semibold text-slate-800 max-w-[200px] truncate uppercase">
                        {cust.name}
                      </td>
                      <td className="p-3 font-mono text-emerald-800 tracking-wider">
                        {cust.taxId}
                      </td>
                      <td className="p-3 text-slate-600 max-w-[250px] truncate" title={cust.address}>
                        {cust.address}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Bạn có chắc muốn xóa khách hàng "${cust.name}" khỏi Database không?`)) {
                              onDeleteCustomer(cust.id);
                            }
                          }}
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded transition cursor-pointer"
                          title="Xóa khách hàng"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. MASTER FEES SECTION */}
      <div className="xl:col-span-5 bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col space-y-4">
        <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
          <Receipt className="text-emerald-600" size={18} />
          Danh mục Sơ đồ Phí (Fees Catalog)
        </h3>

        {/* Create Fee Inline Card */}
        <form onSubmit={handleCreateFee} className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-2 gap-3">
          <h4 className="col-span-2 text-xs font-bold uppercase text-slate-500 flex items-center gap-1">
            <Plus size={14} /> Thêm phí dịch vụ mới
          </h4>

          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">TÊN PHÍ (DESCRIPTION)</label>
            <input
              type="text"
              required
              value={feeDesc}
              onChange={(e) => setFeeDesc(e.target.value)}
              placeholder="Nhập tên phí (Ví dụ: PHÍ SHIPMENT...)"
              className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">VAT % MẶC ĐỊNH</label>
            <select
              value={feeVat}
              onChange={(e) => setFeeVat(Number(e.target.value) || 0)}
              className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value={0}>0 %</option>
              <option value={4}>4 %</option>
              <option value={8}>8 %</option>
              <option value={10}>10 %</option>
            </select>
          </div>

          <div className="flex items-center pl-2 mt-4 select-none">
            <input
              type="checkbox"
              id="feeIsPayBehalf"
              checked={feeIsPayBehalf}
              onChange={(e) => setFeeIsPayBehalf(e.target.checked)}
              className="rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 h-4 w-4 mr-2"
            />
            <label htmlFor="feeIsPayBehalf" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Mặc định Chi hộ?
            </label>
          </div>

          <div className="col-span-2 flex justify-end mt-1">
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-xs py-1.5 px-3 flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <CheckCircle2 size={13} /> Lưu loại Phí
            </button>
          </div>
        </form>

        {/* Fees Listing Section */}
        <div className="space-y-2">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={feeSearch}
              onChange={(e) => setFeeSearch(e.target.value)}
              placeholder="Lọc danh mục phí..."
              className="w-full text-xs bg-white border border-slate-300 rounded p-2 pl-8 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          </div>

          {/* Fees Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-[#f8fafc] text-[#0a4d92] font-semibold border-b border-slate-200 text-[10px] uppercase">
                <tr>
                  <th className="p-3 w-1/2">Tên Loại Phí (Description)</th>
                  <th className="p-3 w-1/6 text-center">VAT %</th>
                  <th className="p-3 w-1/6 text-center">Loại Phí</th>
                  <th className="p-3 w-24 text-center text-slate-400">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredFees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                      Không có loại phí nào.
                    </td>
                  </tr>
                ) : (
                  filteredFees.map((fee) => {
                    if (editingFeeId === fee.id) {
                      return (
                        <tr key={fee.id} className="bg-emerald-50/50 divide-x divide-slate-100">
                          <td className="p-2 font-semibold">
                            <input
                              type="text"
                              value={editFeeDesc}
                              onChange={(e) => setEditFeeDesc(e.target.value)}
                              className="w-full bg-white border border-emerald-300 rounded p-1 text-xs text-slate-800 uppercase focus:ring-1 focus:ring-emerald-500 font-bold"
                              placeholder="Tên loại phí..."
                              autoFocus
                            />
                          </td>
                          <td className="p-2 text-center">
                            <select
                              value={editFeeVat}
                              onChange={(e) => setEditFeeVat(Number(e.target.value) || 0)}
                              className="w-full bg-white border border-slate-300 rounded p-1 text-xs text-slate-800 font-bold select-none cursor-pointer"
                            >
                              <option value={0}>0 %</option>
                              <option value={4}>4 %</option>
                              <option value={8}>8 %</option>
                              <option value={10}>10 %</option>
                            </select>
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center select-none">
                              <input
                                type="checkbox"
                                id={`edit-behalf-${fee.id}`}
                                checked={editFeeIsPayBehalf}
                                onChange={(e) => setEditFeeIsPayBehalf(e.target.checked)}
                                className="rounded text-emerald-600 border-slate-300 h-3.5 w-3.5 mr-1 cursor-pointer"
                              />
                              <label htmlFor={`edit-behalf-${fee.id}`} className="text-[10px] font-bold text-slate-600 cursor-pointer">
                                Chi hộ
                              </label>
                            </div>
                          </td>
                          <td className="p-2 text-center flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveEditFee(fee.id)}
                              className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 p-1 rounded transition cursor-pointer"
                              title="Lưu thay đổi"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingFeeId(null)}
                              className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-1 rounded transition cursor-pointer"
                              title="Hủy"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={fee.id} className="hover:bg-slate-50 transition divide-x divide-slate-100">
                        <td className="p-3 font-semibold text-slate-800 uppercase">
                          {fee.description}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-600">
                          {fee.vatPercent}%
                        </td>
                        <td className="p-3 text-center">
                          {fee.isPayOnBehalf ? (
                            <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded">
                              CHI HỘ
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-500 rounded">
                              DỊCH VỤ
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFeeId(fee.id);
                              setEditFeeDesc(fee.description);
                              setEditFeeVat(fee.vatPercent);
                              setEditFeeIsPayBehalf(!!fee.isPayOnBehalf);
                            }}
                            className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 p-1 rounded transition cursor-pointer"
                            title="Sửa"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Bạn có chắc muốn xóa phí "${fee.description}" khỏi Catalog không?`)) {
                                onDeleteFee(fee.id);
                              }
                            }}
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded transition cursor-pointer"
                            title="Xóa loại phí"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
