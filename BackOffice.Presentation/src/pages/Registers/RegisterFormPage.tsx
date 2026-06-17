import React, { useState, useEffect, useCallback, memo } from "react";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import { API_ENDPOINTS } from "../../constants/api";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import axios from "axios";
import { useStore } from "../../context/StoreContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Detect if text contains Hebrew/Yiddish characters and apply RTL */
const rtlClass = (value: string | null | undefined) =>
  value && /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(value) ? "text-right dir-rtl" : "";

/** Format enum values for display */
const printerTypeLabel = (val: number | null | undefined): string => {
  switch (val) {
    case 0: return "None";
    case 1: return "Standard";
    case 2: return "Star";
    case 3: return "Epson";
    case 4: return "Custom";
    default: return val != null ? `Type ${val}` : "Not Set";
  }
};

const portLabel = (val: number | null | undefined): string => {
  if (val == null) return "Not Set";
  if (val === 0) return "None";
  return `COM${val}`;
};

const baudRateLabel = (val: number | null | undefined): string => {
  if (val == null) return "Not Set";
  const rates: Record<number, string> = { 0: "None", 1: "1200", 2: "2400", 3: "4800", 4: "9600", 5: "19200", 6: "38400", 7: "57600", 8: "115200" };
  return rates[val] || `${val}`;
};

const parityLabel = (val: number | null | undefined): string => {
  if (val == null) return "Not Set";
  const labels: Record<number, string> = { 0: "None", 1: "Odd", 2: "Even", 3: "Mark", 4: "Space" };
  return labels[val] || `${val}`;
};

const dataBitsLabel = (val: number | null | undefined): string => {
  if (val == null) return "Not Set";
  return `${val}`;
};

const stopBitsLabel = (val: number | string | null | undefined): string => {
  if (val == null) return "Not Set";
  const v = Number(val);
  const labels: Record<number, string> = { 0: "None", 1: "1", 2: "1.5", 3: "2" };
  return labels[v] || `${v}`;
};

const drawerTypeLabel = (val: number | null | undefined): string => {
  switch (val) {
    case 0: return "None";
    case 1: return "Printer Kick";
    case 2: return "Serial";
    case 3: return "APG";
    default: return val != null ? `Type ${val}` : "Not Set";
  }
};

const displayTypeLabel = (val: number | null | undefined): string => {
  switch (val) {
    case 0: return "None";
    case 1: return "Logic Controls";
    case 2: return "Epson";
    case 3: return "Bematech";
    case 4: return "Partner Tech";
    default: return val != null ? `Type ${val}` : "Not Set";
  }
};

const scannerTypeLabel = (val: number | null | undefined): string => {
  switch (val) {
    case 0: return "None / Keyboard Wedge";
    case 1: return "Serial";
    case 2: return "USB HID";
    default: return val != null ? `Type ${val}` : "Not Set";
  }
};

const scaleTypeLabel = (val: number | null | undefined): string => {
  switch (val) {
    case 0: return "None";
    case 1: return "CAS";
    case 2: return "Mettler Toledo";
    case 3: return "Digi";
    case 4: return "Fairbanks";
    default: return val != null ? `Type ${val}` : "Not Set";
  }
};

const coinDispenserLabel = (val: number | null | undefined): string => {
  switch (val) {
    case 0: return "None";
    case 1: return "Telequip";
    case 2: return "CPI";
    default: return val != null ? `Type ${val}` : "Not Set";
  }
};

const statusLabel = (val: number | null | undefined): string => {
  switch (val) {
    case 0: return "Active";
    case 1: return "Inactive";
    case 2: return "Deleted";
    default: return val != null ? `Status ${val}` : "Unknown";
  }
};

const statusColor = (val: number | null | undefined): string => {
  switch (val) {
    case 0: return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case 1: return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case 2: return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
};

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface RegisterDetail {
  registerID: string;
  registerNo: string | null;
  compName: string | null;
  storeID: string | null;
  status: number | null;
  receiptPrinter: string | null;
  recieptPrinterType: number | null;
  deliveryLabelPrinter: string | null;
  shelfLabelPrinter: string | null;
  poleDisplayType: number | null;
  poleDisplayPort: number | null;
  pdPortBaudRate: number | null;
  scannerType: number | null;
  scannerPort: number | null;
  scBitsPerSec: number | null;
  scDataBits: number | null;
  scParity: number | null;
  scStopBits: number | null;
  scalePort: number | null;
  slBitsPerSec: number | null;
  slDataBits: number | null;
  slParity: number | null;
  slStopBits: number | null;
  pinPadType: number | null;
  pinPadPort: number | null;
  drawerType: number | null;
  drawerCom: number | null;
  delayTicks: number | null;
  scaleType: number | null;
  coinDispenser: number | null;
  coinDispenserPort: number | null;
  localIPAdddress: string | null;
  version: string | null;
  deviceIP: string | null;
  isTouchScreen: number | null;
  selfCheckout: boolean | null;
  reciptType: number | null;
  printTwoReceipts: number | null;
  verifonePort: string | null;
  verifoneModal: string | null;
  useGateway: number | null;
  useSequelPay: number | null;
  useDataCap: boolean | null;
  serialSwiper: number | null;
  swiperPort: number | null;
  usAePayDevice: string | null;
  usAePayAPI: number | null;
  hideButtons: number | null;
  showWhight: number | null;
  mainScreen: number | null;
  dateCreated: string | null;
  dateModified: string | null;
}

interface RegisterFormPageProps {
  id?: string;
  registerData?: RegisterDetail;
  __tabId?: string;
}

// ─── Field Display Component ─────────────────────────────────────────────────
const Field: React.FC<{ label: string; value: string | null | undefined; className?: string }> = ({ label, value, className }) => (
  <div className={`flex flex-col ${className || ""}`}>
    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</span>
    <span className={`text-sm font-medium text-gray-900 dark:text-white ${rtlClass(value)}`}>
      {value || <span className="text-gray-400 italic">Not Set</span>}
    </span>
  </div>
);

// ─── Section Component ───────────────────────────────────────────────────────
const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; color?: string }> = ({ title, icon, children, color = "brand" }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div className={`px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-${color}-50 dark:bg-gray-750 flex items-center gap-2`}>
      <span className={`text-${color}-600 dark:text-${color}-400`}>{icon}</span>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
    </div>
    <div className="p-4">
      {children}
    </div>
  </div>
);

// ─── Icons ───────────────────────────────────────────────────────────────────
const PrinterIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
);

const CashDrawerIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7l2-3h12l2 3M9 12h6" />
  </svg>
);

const DisplayIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const ScannerIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
  </svg>
);

const ScaleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
  </svg>
);

const CoinIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const NetworkIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);

const PaymentIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// ─── Main Component ──────────────────────────────────────────────────────────
const RegisterFormPage: React.FC<RegisterFormPageProps> = memo(function RegisterFormPage({ id, registerData, __tabId }) {
  const { closeTab } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();
  const { currentStore } = useStore();
  const [data, setData] = useState<RegisterDetail | null>(registerData || null);
  const [isLoading, setIsLoading] = useState(!registerData);
  const [error, setError] = useState<string | null>(null);

  // Fetch register data from the grid endpoint filtered by ID
  const fetchRegisterData = useCallback(async () => {
    if (!id || registerData) return;
    setIsLoading(true);
    setError(null);
    try {
      const headers = getAuthHeaders();
      // Use the GET_ALL endpoint with a filter to get the specific register
      const response = await axios.get(API_ENDPOINTS.REGISTERS.GET_ALL, {
        headers,
        params: {
          startRow: 0,
          endRow: 1000,
          sortColumn: "registerNo",
          sortDirection: "asc",
          ...(currentStore?.storeId ? { storeId: currentStore.storeId } : {}),
        },
      });

      if (response.data?.isSuccess && response.data.response?.data) {
        const allRegisters = response.data.response.data;
        const register = allRegisters.find((r: any) => r.registerID === id);
        if (register) {
          setData(register);
        } else {
          setError("Register not found.");
        }
      } else {
        setError("Failed to load register data.");
      }
    } catch (err: any) {
      console.error("Error fetching register:", err);
      setError(err.message || "Failed to load register data.");
    } finally {
      setIsLoading(false);
    }
  }, [id, registerData, getAuthHeaders, currentStore?.storeId]);

  useEffect(() => {
    fetchRegisterData();
  }, [fetchRegisterData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Loading register details...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">{error || "Register not found"}</p>
          <button
            onClick={() => closeTab(__tabId || "")}
            className="mt-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="register-form-page h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Register {data.registerNo || "N/A"}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {data.compName || "No Computer Name"} 
                {data.localIPAdddress && <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{data.localIPAdddress}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(data.status)}`}>
              {statusLabel(data.status)}
            </span>
            <button
              onClick={() => closeTab(__tabId || "")}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* General Info */}
        <Section title="General Information" icon={<SettingsIcon />}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Register No" value={data.registerNo} />
            <Field label="Computer Name" value={data.compName} />
            <Field label="Local IP" value={data.localIPAdddress} />
            <Field label="Device IP" value={data.deviceIP} />
            <Field label="Version" value={data.version} />
            <Field label="Touch Screen" value={data.isTouchScreen === 1 ? "Yes" : data.isTouchScreen === 0 ? "No" : "Not Set"} />
            <Field label="Self Checkout" value={data.selfCheckout === true ? "Yes" : data.selfCheckout === false ? "No" : "Not Set"} />
            <Field label="Main Screen" value={data.mainScreen != null ? `${data.mainScreen}` : null} />
          </div>
        </Section>

        {/* Receipt Printer */}
        <Section title="Receipt Printer" icon={<PrinterIcon />} color="blue">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Printer Name" value={data.receiptPrinter} />
            <Field label="Printer Type" value={printerTypeLabel(data.recieptPrinterType)} />
            <Field label="Receipt Type" value={data.reciptType != null ? `Type ${data.reciptType}` : null} />
            <Field label="Print Two Receipts" value={data.printTwoReceipts === 1 ? "Yes" : data.printTwoReceipts === 0 ? "No" : "Not Set"} />
          </div>
        </Section>

        {/* Label Printers */}
        <Section title="Label Printers" icon={<PrinterIcon />} color="purple">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Delivery Label Printer" value={data.deliveryLabelPrinter} className="col-span-2" />
            <Field label="Shelf Label Printer" value={data.shelfLabelPrinter} className="col-span-2" />
          </div>
        </Section>

        {/* Cash Drawer */}
        <Section title="Cash Drawer" icon={<CashDrawerIcon />} color="green">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Drawer Type" value={drawerTypeLabel(data.drawerType)} />
            <Field label="COM Port" value={portLabel(data.drawerCom)} />
            <Field label="Delay Ticks" value={data.delayTicks != null ? `${data.delayTicks}` : null} />
          </div>
        </Section>

        {/* Pole Display */}
        <Section title="Pole Display" icon={<DisplayIcon />} color="indigo">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Display Type" value={displayTypeLabel(data.poleDisplayType)} />
            <Field label="Port" value={portLabel(data.poleDisplayPort)} />
            <Field label="Baud Rate" value={baudRateLabel(data.pdPortBaudRate)} />
          </div>
        </Section>

        {/* Barcode Scanner */}
        <Section title="Barcode Scanner" icon={<ScannerIcon />} color="orange">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Scanner Type" value={scannerTypeLabel(data.scannerType)} />
            <Field label="Port" value={portLabel(data.scannerPort)} />
            <Field label="Bits/Sec" value={baudRateLabel(data.scBitsPerSec)} />
            <Field label="Data Bits" value={dataBitsLabel(data.scDataBits)} />
            <Field label="Stop Bits" value={stopBitsLabel(data.scStopBits)} />
            <Field label="Parity" value={parityLabel(data.scParity)} />
          </div>
        </Section>

        {/* Scale */}
        <Section title="Scale" icon={<ScaleIcon />} color="teal">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Scale Type" value={scaleTypeLabel(data.scaleType)} />
            <Field label="Port" value={portLabel(data.scalePort)} />
            <Field label="Bits/Sec" value={baudRateLabel(data.slBitsPerSec)} />
            <Field label="Data Bits" value={dataBitsLabel(data.slDataBits)} />
            <Field label="Stop Bits" value={stopBitsLabel(data.slStopBits)} />
            <Field label="Parity" value={parityLabel(data.slParity)} />
            <Field label="Show Weight" value={data.showWhight === 1 ? "Yes" : data.showWhight === 0 ? "No" : "Not Set"} />
          </div>
        </Section>

        {/* Coin Dispenser */}
        <Section title="Coin Dispenser" icon={<CoinIcon />} color="amber">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Type" value={coinDispenserLabel(data.coinDispenser)} />
            <Field label="Port" value={portLabel(data.coinDispenserPort)} />
          </div>
        </Section>

        {/* Payment Devices */}
        <Section title="Payment Devices" icon={<PaymentIcon />} color="rose">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Pin Pad Type" value={data.pinPadType != null ? `Type ${data.pinPadType}` : null} />
            <Field label="Pin Pad Port" value={portLabel(data.pinPadPort)} />
            <Field label="Serial Swiper" value={data.serialSwiper != null ? `Type ${data.serialSwiper}` : null} />
            <Field label="Swiper Port" value={portLabel(data.swiperPort)} />
            <Field label="Verifone Port" value={data.verifonePort} />
            <Field label="Verifone Model" value={data.verifoneModal} />
            <Field label="Use Gateway" value={data.useGateway === 1 ? "Yes" : data.useGateway === 0 ? "No" : "Not Set"} />
            <Field label="Use SequelPay" value={data.useSequelPay === 1 ? "Yes" : data.useSequelPay === 0 ? "No" : "Not Set"} />
            <Field label="Use DataCap" value={data.useDataCap === true ? "Yes" : data.useDataCap === false ? "No" : "Not Set"} />
            <Field label="USAePay Device" value={data.usAePayDevice} />
            <Field label="USAePay API" value={data.usAePayAPI != null ? `${data.usAePayAPI}` : null} />
          </div>
        </Section>

        {/* Network & Other */}
        <Section title="Network & Other Settings" icon={<NetworkIcon />} color="cyan">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Local IP Address" value={data.localIPAdddress} />
            <Field label="Device IP" value={data.deviceIP} />
            <Field label="Hide Buttons" value={data.hideButtons != null ? `${data.hideButtons}` : null} />
            <Field label="Date Created" value={data.dateCreated ? new Date(data.dateCreated).toLocaleDateString() : null} />
            <Field label="Date Modified" value={data.dateModified ? new Date(data.dateModified).toLocaleDateString() : null} />
          </div>
        </Section>
      </div>
    </div>
  );
});

export default RegisterFormPage;
