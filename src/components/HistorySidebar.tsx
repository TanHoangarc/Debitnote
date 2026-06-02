import React from "react";
import { DebitNote } from "../types";
import { FileText, Trash2, History, Database, Search } from "lucide-react";

interface HistorySidebarProps {
  history: DebitNote[];
  onSelect: (debitNote: DebitNote) => void;
  onDelete: (id: string) => void;
  activeId?: string;
}

export default function HistorySidebar({ history, onSelect, onDelete, activeId }: HistorySidebarProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredHistory = history.filter((item) => {
    const term = searchQuery.toLowerCase();
    return (
      (item.companyName || "").toLowerCase().includes(term) ||
      (item.jobNo || "").toLowerCase().includes(term) ||
      (item.hblMbl || "").toLowerCase().includes(term)
    );
  });

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  const calculateTotalVnd = (item: DebitNote) => {
    let total = 0;
    item.charges.forEach((charge) => {
      const qty = Number(charge.qty) || 0;
      const price = Number(charge.price) || 0;
      const vat = Number(charge.vatPercent) || 0;
      const inclVat = qty * price * (1 + vat / 100);

      let chargeVnd = 0;
      if (charge.currency === "USD") {
        chargeVnd = inclVat * (Number(item.roe) || 1);
      } else {
        chargeVnd = inclVat;
      }
      total += chargeVnd;
    });
    return total;
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 h-full flex flex-col shadow-sm">
      <h3 className="font-bold text-slate-700 flex items-center gap-2 pb-3 border-b border-slate-100">
        <History size={18} className="text-emerald-600" />
        Lịch sử lưu trữ ( {history.length} )
      </h3>

      {/* Search Input Filter */}
      <div className="relative my-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm công ty, Job No, HBL..."
          className="w-full text-xs bg-slate-50 border border-slate-300 rounded p-2 pl-8 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto space-y-2 max-h-[450px] md:max-h-none pr-1">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs italic">
            Không tìm thấy bản ghi nào.
          </div>
        ) : (
          filteredHistory.map((item) => {
            const isActive = item.id === activeId;
            const totalVnd = calculateTotalVnd(item);

            return (
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                className={`group flex items-start gap-2 p-3 rounded-lg border transition cursor-pointer text-left relative ${
                  isActive
                    ? "bg-emerald-50/55 border-emerald-300 ring-1 ring-emerald-300"
                    : "bg-slate-50/40 border-slate-200 hover:bg-slate-50/80 hover:border-slate-300"
                }`}
              >
                <div className={`p-1.5 rounded mt-0.5 ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200/60 text-slate-500"}`}>
                  <FileText size={16} />
                </div>
                
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-1.5 justify-between">
                    <span className="font-mono text-[11px] font-bold text-emerald-800 uppercase block truncate">
                      {item.jobNo || "VNSGNFGDXXXX"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-sans shrink-0">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                  
                  <h4 className="text-xs font-semibold text-slate-800 uppercase truncate mt-1">
                    {item.companyName || "Chưa đặt tên khách hàng"}
                  </h4>

                  <div className="text-[9px] text-slate-500 font-mono mt-1 space-y-0.5">
                    <p>Bill: {item.hblMbl || "-"}</p>
                    <p className="font-bold text-slate-700">Tổng tiền: {formatCurrency(totalVnd)}</p>
                  </div>
                </div>

                {/* Inline Delete Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Bạn có chắc muốn xóa Debit Note này khỏi lịch sử không?")) {
                      onDelete(item.id);
                    }
                  }}
                  className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-600 bg-white/80 p-1 rounded-sm border border-slate-200/50 shadow-xs transition duration-150 cursor-pointer"
                  title="Xóa bản ghi"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
