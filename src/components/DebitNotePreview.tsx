import React, { useMemo } from "react";
import { DebitNote, ChargeItem } from "../types";
import { Printer } from "lucide-react";

interface DebitNotePreviewProps {
  data: DebitNote;
}

export default function DebitNotePreview({ data }: DebitNotePreviewProps) {
  // Sort charges by VAT: 0% first, then 8%, then 10%
  // And split them by "Chi hộ" (Pay on behalf) status.
  const { logisticsCharges, payOnBehalfCharges } = useMemo(() => {
    const logistics: ChargeItem[] = [];
    const behalf: ChargeItem[] = [];

    data.charges.forEach((charge) => {
      if (charge.isPayOnBehalf) {
        behalf.push(charge);
      } else {
        logistics.push(charge);
      }
    });

    // Sắp xếp các phí có VAT: 0% lên trước, sau đó đến 8%, 10%
    const sortByVat = (a: ChargeItem, b: ChargeItem) => {
      const vatA = a.vatPercent || 0;
      const vatB = b.vatPercent || 0;
      return vatA - vatB;
    };

    return {
      logisticsCharges: [...logistics].sort(sortByVat),
      payOnBehalfCharges: [...behalf].sort(sortByVat),
    };
  }, [data.charges]);

  // Calculations
  const calculations = useMemo(() => {
    let totalVND = 0;
    let sumUSDLocalAndSurcharge = 0; // THC + BILL + SEAL + TELEX = surcharges (excluding ocean freight if standard, but let's sum surcharges explicitly or all USD charges)
    let totalUSDAll = 0;

    data.charges.forEach((charge) => {
      const qty = Number(charge.qty) || 0;
      const price = Number(charge.price) || 0;
      const vat = Number(charge.vatPercent) || 0;
      const inclVat = qty * price * (1 + vat / 100);

      let rate = 1;
      if (charge.currency !== "VND") {
        const rates = data.exchangeRates || { "USD": Number(data.roe) || 26400 };
        if (rates[charge.currency] !== undefined) {
          rate = Number(rates[charge.currency]) || 0;
        } else if (charge.currency === "USD") {
          rate = Number(data.roe) || 26400;
        }
      }
      const chargeVnd = inclVat * rate;

      if (charge.currency === "USD") {
        totalUSDAll += inclVat;
        // In the typical template, the "USD TOTAL" column compiles local surcharges (e.g. THC, BILL, SEAL, TELEX) which is surcharges under USD
        if (charge.description !== "CUỐC BIỂN" && !charge.isPayOnBehalf) {
          sumUSDLocalAndSurcharge += inclVat;
        }
      }
      totalVND += chargeVnd;
    });

    // If sumUSDLocalAndSurcharge exists, utilize it for USD column total, otherwise fallback to totalUSDAll
    const totalUSDColumn = sumUSDLocalAndSurcharge > 0 ? sumUSDLocalAndSurcharge : totalUSDAll;

    return {
      totalVND,
      totalUSDColumn,
      totalUSDAll,
    };
  }, [data.charges, data.roe, data.exchangeRates]);

  // Formats Helper
  const formatNum = (num: number, decimals: number = 2) => {
    if (isNaN(num) || num === null) return "0.00";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `DEBIT NOTE BL ${data.hblMbl || ""}`.trim();
    window.print();
    document.title = originalTitle;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Control Actions (Hidden when printing) */}
      <div className="flex justify-between items-center mb-4 p-4 bg-white border border-slate-200 rounded-lg shadow-xs print:hidden">
        <div className="text-sm text-slate-500">
          <span className="font-semibold text-slate-700">Khổ giấy:</span> A4 Portrait (Chuẩn in ấn)
        </div>
        <button
          onClick={handlePrint}
          id="btn-print-debit-note"
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm transition shadow-xs cursor-pointer"
        >
          <Printer size={16} />
          In Debit Note (A4 PDF)
        </button>
      </div>

      {/* Printable Area (Styled to look exactly like standard A4 paper) */}
      <div className="flex-1 bg-slate-100 overflow-auto p-4 flex justify-center print:bg-white print:p-0">
        <div
          id="printable-debit-note"
          className="bg-white text-slate-800 p-8 shadow-md border border-slate-200 print:border-none print:shadow-none w-[210mm] min-h-[297mm] relative flex flex-col justify-between font-sans text-xs select-text leading-snug"
          style={{
            minHeight: "297mm",
            width: "210mm",
          }}
        >
          {/* Main Content Group */}
          <div>
            {/* Header / Logo Section - Replaced with official company letterhead image */}
            <div className="mb-4 border-b border-slate-200 pb-2">
              <img
                src="https://i.ibb.co/Kx32Z01D/LH-VIETNAMESE.jpg"
                alt="LONG HOANG INTERNATIONAL TRANSPORT AND LOGISTICS"
                className="w-full object-contain max-h-[140px]"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Document Title */}
            <div className="text-center my-5">
              <h2 className="text-xl font-bold tracking-wider text-[#0a4d92] uppercase font-serif">
                DEBIT NOTE
              </h2>
            </div>

            {/* Client Info Block */}
            <div className="mb-4 space-y-1 bg-slate-50/50 p-2 rounded-xs border border-slate-100">
              <div className="flex items-start">
                <span className="font-bold w-12 shrink-0 text-[#0a4d92]">TO:</span>
                <span className="font-bold uppercase text-slate-900 text-sm">
                  {data.companyName || "CÔNG TY CHƯA CẬP NHẬT"}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  <span className="font-semibold text-slate-500">Job:</span>
                  <span className="font-mono text-slate-800 font-bold">{data.jobNo || ""}</span>
                </span>
              </div>
              <div className="flex items-center">
                <span className="font-bold w-12 shrink-0 text-[#0a4d92]">MST:</span>
                <span className="font-mono text-slate-800 font-semibold tracking-wider">
                  {data.taxId ? data.taxId.split("").join(" ") : "----------------"}
                </span>
              </div>
              <div className="flex items-start">
                <span className="font-bold w-12 shrink-0 text-[#0a4d92]">Địa chỉ:</span>
                <span className="text-slate-700">{data.address || "----------------"}</span>
              </div>
            </div>

            {/* Shipments Metadata Grid */}
            <div className="grid grid-cols-12 gap-0 mb-4 border border-slate-300">
              {/* Left Column Fields */}
              <div className="col-span-7 border-r border-slate-300 grid grid-cols-3 divide-y divide-slate-200">
                <div className="col-span-1 p-1.5 font-semibold text-slate-600 bg-slate-50">Carrier/Agent</div>
                <div className="col-span-2 p-1.5 font-medium border-l border-slate-200">{data.carrierAgent || "-"}</div>

                <div className="col-span-1 p-1.5 font-semibold text-slate-600 bg-slate-50">HBL/MBL</div>
                <div className="col-span-2 p-1.5 font-mono border-l border-slate-200">{data.hblMbl || "-"}</div>

                <div className="col-span-1 p-1.5 font-semibold text-slate-600 bg-slate-50">P.O.L</div>
                <div className="col-span-2 p-1.5 font-medium border-l border-slate-200">{data.pol || "-"}</div>

                <div className="col-span-1 p-1.5 font-semibold text-slate-600 bg-slate-50">P.O.D</div>
                <div className="col-span-2 p-1.5 font-medium border-l border-slate-200">{data.pod || "-"}</div>

                <div className="col-span-1 p-1.5 font-semibold text-slate-600 bg-slate-50">Volume</div>
                <div className="col-span-2 p-1.5 font-medium border-l border-slate-200">{data.volume || "-"}</div>

                <div className="col-span-1 p-1.5 font-semibold text-slate-600 bg-slate-50">R.O.E</div>
                <div className="col-span-2 p-1.5 font-mono border-l border-slate-200 space-y-1">
                  {Object.entries(data.exchangeRates ? data.exchangeRates : (data.roe ? { "USD": data.roe } : {})).map(([curr, rate]) => (
                    <div key={curr} className="flex justify-between max-w-[160px] text-xs">
                      <span className="font-bold text-slate-500">{curr}:</span>
                      <span className="font-bold text-slate-800">{formatNum(rate, 0)} <span className="text-[9px] text-slate-400 font-sans font-normal">VND</span></span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column Fields */}
              <div className="col-span-5 grid grid-cols-3 divide-y divide-slate-200">
                <div className="col-span-1 p-1.5 font-semibold text-slate-600 bg-slate-50">ETD/ETA</div>
                <div className="col-span-2 p-1.5 font-medium border-l border-slate-200">
                  {data.etdEta || "-"}
                </div>

                <div className="col-span-1 p-1.5 font-semibold text-slate-600 bg-slate-50 h-full">Note</div>
                <div className="col-span-2 p-1.5 border-l border-slate-200 min-h-[60px] flex items-start text-slate-600 italic">
                  {data.note || "No specific note."}
                </div>
              </div>
            </div>

            {/* Charges Table */}
            <div className="overflow-x-auto border border-slate-400">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#D7A29E] text-slate-900 border-b border-slate-400 font-bold uppercase text-[10px] text-center divide-x divide-slate-400">
                    <td className="p-1 pb-1.5 pt-1.5 px-2 text-center w-2/5 font-bold">DESCRIPTION</td>
                    <td className="p-1 pb-1.5 pt-1.5 w-12 font-bold">Q'ty (Unit)</td>
                    <td className="p-1 pb-1.5 pt-1.5 w-16 font-bold">PRICE</td>
                    <td className="p-1 pb-1.5 pt-1.5 w-12 font-bold">VAT %</td>
                    <td className="p-1 pb-1.5 pt-1.5 w-12 font-bold">CURR</td>
                    <td className="p-1 pb-1.5 pt-1.5 w-20 font-bold">Amount (Incl VAT)</td>
                    <td className="p-1 pb-1.5 pt-1.5 w-24 font-bold">AMOUNT VND</td>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-300 text-[11px]">
                  {/* Category A: LOGISTICS CHARGES */}
                  <tr className="bg-white font-bold text-slate-900 text-[11px] border-b border-slate-400">
                    <td colSpan={7} className="p-1 px-2 text-left uppercase tracking-wide">
                      LOGISTICS CHARGE ( PHÍ DỊCH VỤ )
                    </td>
                  </tr>
                  
                  {logisticsCharges.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-1.5 text-center text-slate-400 italic">Không có danh mục phí dịch vụ.</td>
                    </tr>
                  ) : (
                    logisticsCharges.map((charge, idx) => {
                      const qty = Number(charge.qty) || 0;
                      const price = Number(charge.price) || 0;
                      const vat = Number(charge.vatPercent) || 0;
                      const inclVat = qty * price * (1 + vat / 100);
                      let rate = 1;
                      if (charge.currency !== "VND") {
                        const rates = data.exchangeRates || { "USD": Number(data.roe) || 26400 };
                        if (rates[charge.currency] !== undefined) {
                          rate = Number(rates[charge.currency]) || 0;
                        } else if (charge.currency === "USD") {
                          rate = Number(data.roe) || 26400;
                        }
                      }
                      const amountVnd = inclVat * rate;

                      return (
                        <tr key={charge.id || idx} className="hover:bg-slate-50 divide-x divide-slate-300 text-slate-800 text-center border-b border-slate-200">
                          <td className="p-1 px-2 text-left font-medium max-w-[200px] truncate">{charge.description}</td>
                          <td className="p-1 font-mono">{formatNum(qty, 2)}</td>
                          <td className="p-1 font-mono text-right px-2">{formatNum(price, price % 1 === 0 ? 0 : 2)}</td>
                          <td className="p-1 font-mono">{vat > 0 ? `${vat}%` : "-"}</td>
                          <td className="p-1 font-semibold text-slate-600">{charge.currency}</td>
                          <td className="p-1 font-mono text-right px-2">{formatNum(inclVat, 2)}</td>
                          <td className="p-1 font-mono text-right px-2 font-semibold">{formatNum(amountVnd, 0)}</td>
                        </tr>
                      );
                    })
                  )}

                  {/* Category B: PAY ON BEHALF CHARGES */}
                  <tr className="bg-white font-bold text-slate-900 text-[11px] border-b border-slate-400 border-t border-slate-400">
                    <td colSpan={7} className="p-1 px-2 text-left uppercase tracking-wide">
                      PAY ON BEHALF ( CHI HỘ )
                    </td>
                  </tr>

                  {payOnBehalfCharges.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-1.5 text-center text-slate-400 italic">Không có phí chi hộ.</td>
                    </tr>
                  ) : (
                    payOnBehalfCharges.map((charge, idx) => {
                      const qty = Number(charge.qty) || 0;
                      const price = Number(charge.price) || 0;
                      const vat = Number(charge.vatPercent) || 0;
                      const inclVat = qty * price * (1 + vat / 100);
                      let rate = 1;
                      if (charge.currency !== "VND") {
                        const rates = data.exchangeRates || { "USD": Number(data.roe) || 26400 };
                        if (rates[charge.currency] !== undefined) {
                          rate = Number(rates[charge.currency]) || 0;
                        } else if (charge.currency === "USD") {
                          rate = Number(data.roe) || 26400;
                        }
                      }
                      const amountVnd = inclVat * rate;

                      return (
                        <tr key={charge.id || idx} className="hover:bg-slate-50 divide-x divide-slate-300 text-slate-800 text-center border-b border-slate-200">
                          <td className="p-1 px-2 text-left font-medium max-w-[200px] truncate text-amber-900">{charge.description}</td>
                          <td className="p-1 font-mono">{formatNum(qty, 2)}</td>
                          <td className="p-1 font-mono text-right px-2">{formatNum(price, price % 1 === 0 ? 0 : 2)}</td>
                          <td className="p-1 font-mono">{vat > 0 ? `${vat}%` : "-"}</td>
                          <td className="p-1 font-semibold text-slate-600">{charge.currency}</td>
                          <td className="p-1 font-mono text-right px-2">{formatNum(inclVat, 2)}</td>
                          <td className="p-1 font-mono text-right px-2 font-semibold text-amber-950">{formatNum(amountVnd, 0)}</td>
                        </tr>
                      );
                    })
                  )}

                  {/* GRAND TOTAL ROW */}
                  <tr className="bg-[#D7A29E] font-bold border-t border-slate-400 text-center text-xs divide-x divide-slate-400 text-slate-900">
                    <td colSpan={4} className="p-2 text-center text-slate-900 font-extrabold tracking-wider uppercase">
                      TOTAL
                    </td>
                    <td className="p-2 text-slate-900 text-center font-extrabold">USD</td>
                    <td className="p-2 text-right px-2 font-mono text-slate-900 font-extrabold">
                      {formatNum(calculations.totalUSDColumn, 1)}
                    </td>
                    <td className="p-2 text-right px-2 font-mono text-slate-900 font-extrabold text-[13px]">
                      {formatNum(calculations.totalVND, 1)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Section: Bank Details */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="grid grid-cols-12 gap-3 text-[10px] text-slate-600 leading-relaxed divide-x divide-slate-100">
              <div className="col-span-8">
                <h4 className="font-bold text-[#0a4d92] tracking-tight mb-1 uppercase text-[10px]">BANK DETAILS:</h4>
                <div className="space-y-0.5 font-sans">
                  <p>
                    <span className="font-semibold text-slate-700">Company Name:</span> CÔNG TY TNHH TIẾP VẬN VÀ VẬN TẢI QUỐC TẾ LONG HOÀNG
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Account NO.:</span> 19135447033015
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Bank Name:</span> TECHCOMBANK - CHI NHÁNH HCM
                  </p>
                </div>
              </div>

              <div className="col-span-4 pl-4 flex flex-col justify-end items-center text-center">
                <div className="border-b border-slate-200 w-full mb-8"></div>
                <p className="font-bold text-[#0a4d92] uppercase text-[9px] tracking-wider">Authorized Signature</p>
                <p className="text-[8px] text-slate-400 mt-0.5">Please check and settle within 7 days.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
