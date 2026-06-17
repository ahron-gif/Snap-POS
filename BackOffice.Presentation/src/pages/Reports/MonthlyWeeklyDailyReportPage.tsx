import React from "react"
// Item Daily Sales is rendered as a desktop-parity pivot (rows: Department > Item > Barcode,
// cols: per-date Amount+Qty). The old flat grid page lives at ./ItemDailySalesReportPage and is
// no longer wired up, but kept in the repo as a reference / fallback.
import ItemDailySalesPivotPage from "./ItemDailySalesPivotPage"
// Item Weekly Sales also rendered as a desktop-parity pivot (week-start date columns,
// Amount + Qty under each). The old flat grid lives at ./ItemWeeklySalesReportPage,
// kept in the repo as reference but no longer wired up.
import ItemWeeklySalesPivotPage from "./ItemWeeklySalesPivotPage"
// Item Monthly Sales as a desktop-parity pivot (Year > Month columns, sticky-left dept/item).
// Old flat grid lives at ./ItemMonthlySalesReportPage, kept as reference but unused.
import ItemMonthlySalesPivotPage from "./ItemMonthlySalesPivotPage"
// Department Daily Sales as a desktop-parity pivot (Date+Store sticky left,
// Department columns scrolling right). Old flat grid kept at ./DepartmentDailySalesReportPage
// as reference but no longer wired.
import DepartmentDailySalesPivotPage from "./DepartmentDailySalesPivotPage"
// Department Weekly + Monthly Sales also rendered as desktop-parity pivots (Dept+Store sticky
// left, weeks scrolling right; or Year+Month left, Department>Store right). Old flat grids
// kept at ./DepartmentWeekly/MonthlySalesReportPage as reference but no longer wired.
import DepartmentWeeklySalesPivotPage from "./DepartmentWeeklySalesPivotPage"
import DepartmentMonthlySalesPivotPage from "./DepartmentMonthlySalesPivotPage"
import TotalDailySalesReportPage from "./TotalDailySalesReportPage"
import TotalWeeklySalesReportPage from "./TotalWeeklySalesReportPage"
import TotalMonthlySalesReportPage from "./TotalMonthlySalesReportPage"

type SubReportKey =
  | "item-daily"
  | "item-weekly"
  | "item-monthly"
  | "department-daily"
  | "department-weekly"
  | "department-monthly"
  | "total-daily"
  | "total-weekly"
  | "total-monthly"

interface MonthlyWeeklyDailyReportProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
  }
  /** When opened from Report Manager, open directly on this sub-report. */
  subReportKey?: SubReportKey
}

const MonthlyWeeklyDailyReportPage: React.FC<MonthlyWeeklyDailyReportProps> = ({ filters, subReportKey }) => {
  const activeKey: SubReportKey = subReportKey ?? "item-daily"

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Monthly / Weekly / Daily</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Choose a report from the Report Manager sales submenu.
          </p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Active report body only – no inner submenu */}
        <main className="flex-1 min-w-0">
          {activeKey === "item-daily" && <ItemDailySalesPivotPage filters={filters} />}
          {activeKey === "item-weekly" && <ItemWeeklySalesPivotPage filters={filters} />}
          {activeKey === "item-monthly" && <ItemMonthlySalesPivotPage filters={filters} />}
          {activeKey === "department-daily" && <DepartmentDailySalesPivotPage filters={filters} />}
          {activeKey === "department-weekly" && <DepartmentWeeklySalesPivotPage filters={filters} />}
          {activeKey === "department-monthly" && <DepartmentMonthlySalesPivotPage filters={filters} />}
          {activeKey === "total-daily" && <TotalDailySalesReportPage filters={filters} />}
          {activeKey === "total-weekly" && <TotalWeeklySalesReportPage filters={filters} />}
          {activeKey === "total-monthly" && <TotalMonthlySalesReportPage filters={filters} />}
        </main>
      </div>
    </div>
  )
}

export default MonthlyWeeklyDailyReportPage

