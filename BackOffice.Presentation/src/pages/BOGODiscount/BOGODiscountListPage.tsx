import React, { useState, useCallback, useMemo } from "react";
import Button from "../../components/ui/button/Button";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import { API_ENDPOINTS } from "../../constants/api";
import ServerGrid from "../../components/common/ServerGrid/ServerGrid";
import { Column } from "../../components/common/ServerGrid/types/grid";

const BASE_API_URL = import.meta.env.VITE_API_BASE_URL || "";

interface BOGODiscountListPageProps {
  __tabId?: string;
}

const BOGODiscountListPage: React.FC<BOGODiscountListPageProps> = ({ __tabId }) => {
  const { openTab } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();
  const headers = getAuthHeaders();

  const columns: Column[] = useMemo(() => [
    { field: "name", headerName: "Discount Name", width: 200, sortable: true, filterable: true },
    { field: "buyQty", headerName: "Buy Qty", width: 120, sortable: true },
    { field: "getQty", headerName: "Get Qty", width: 120, sortable: true },
    { field: "discountPercent", headerName: "Discount %", width: 120, sortable: true, dataType: "number" },
    { field: "startDate", headerName: "Start Date", width: 130, sortable: true, dataType: "date" },
    { field: "endDate", headerName: "End Date", width: 130, sortable: true, dataType: "date" },
    { field: "isActive", headerName: "Active", width: 80, sortable: true, dataType: "boolean" },
  ], []);

  const handleAdd = useCallback(() => {
    openTab({
      component: "BOGODiscountFormPage",
      title: "New BOGO Discount",
      closable: true, props: { isNew: true },
    });
  }, [openTab]);

  const handleEdit = useCallback((row: any) => {
    openTab({
      component: "BOGODiscountFormPage",
      title: `Edit: ${row.name || "BOGO Discount"}`,
      closable: true, props: { id: row.bogoDiscountID || row.id, mode: "edit" },
    });
  }, [openTab]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-800">BOGO Discounts</h2>
        <Button size="sm" onClick={handleAdd}>+ Add BOGO Discount</Button>
      </div>
      <div className="flex-1 p-4">
        <ServerGrid
          columns={columns}
          apiUrl={`${BASE_API_URL}/api/BOGODiscount/GetAllBOGODiscounts`}
          serverSide={true}
          getAuthHeaders={getAuthHeaders}
          onEdit={handleEdit}
          getRowId={(row) => row.bogoDiscountID || row.id}
        />
      </div>
    </div>
  );
};

export default BOGODiscountListPage;
