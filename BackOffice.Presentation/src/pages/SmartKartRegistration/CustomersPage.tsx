import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { fetchRegistrations, fetchRegistrationById, createRegistration, updateRegistration, deleteRegistration } from '../../store/slices/registrationSlice';
import type { Registration, CreateRegistrationDto, UpdateRegistrationDto } from '../../services/smartKartReg/registrationApi';

const SkeletonRow: React.FC = () => (
  <tr className="animate-pulse">
    {[...Array(8)].map((_, i) => (
      <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>
    ))}
  </tr>
);

const statusLabel = (status: number) => {
  switch (status) {
    case 1: return { text: 'Active', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
    case 2: return { text: 'Deleted', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    default: return { text: 'Inactive', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400' };
  }
};

const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

const CustomersPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { registrations, totalRecords, loading, saving } = useSelector((state: RootState) => state.registration);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const emptyForm: CreateRegistrationDto = {
    storeName: '',
    userName: '',
    password: '',
    dataBaseName: '',
    storeType: 0,
    licenseExpires: '',
    address: '',
    cityStateZip: '',
    phone: '',
    fax: '',
    email: '',
    multipleLocation: false,
    phoneOrder: false,
    loyalty: false,
    emailService: false,
    textService: false,
    giftCards: false,
    timeAttendance: false,
    status: 1,
    salesPerson: '',
    regUser: '',
    serverName: '',
    versionName: '',
    posLic: 0,
    boLic: 0,
    isSmartKart: false,
    versionId: 0,
    apiurl: '',
  };

  const [formData, setFormData] = useState<CreateRegistrationDto>(emptyForm);

  const loadData = useCallback(() => {
    const params: Record<string, any> = {
      startRow: page * pageSize,
      endRow: (page + 1) * pageSize,
      sortColumn: 'DateCreated',
      sortDirection: 'desc',
    };
    if (search.trim()) {
      params.customGridSearchText = search.trim();
      params.customGridSearchColumns = 'StoreName,DataBaseName,Email,Phone,SalesPerson';
    }
    dispatch(fetchRegistrations(params));
  }, [dispatch, page, pageSize, search]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEditModal = async (r: Registration) => {
    setEditingId(r.registrationId);
    setShowModal(true);
    setLoadingDetail(true);
    try {
      const detail = await dispatch(fetchRegistrationById(r.registrationId)).unwrap();
      setFormData({
        storeName: detail.storeName || '',
        userName: detail.userName || '',
        password: detail.password || '',
        dataBaseName: detail.dataBaseName || '',
        storeType: detail.storeType ?? 0,
        licenseExpires: detail.licenseExpires || '',
        address: detail.address || '',
        cityStateZip: detail.cityStateZip || '',
        phone: detail.phone || '',
        fax: detail.fax || '',
        email: detail.email || '',
        multipleLocation: detail.multipleLocation ?? false,
        phoneOrder: detail.phoneOrder ?? false,
        loyalty: detail.loyalty ?? false,
        emailService: detail.emailService ?? false,
        textService: detail.textService ?? false,
        giftCards: detail.giftCards ?? false,
        timeAttendance: detail.timeAttendance ?? false,
        status: detail.status ?? 1,
        salesPerson: detail.salesPerson || '',
        regUser: detail.regUser || '',
        serverName: detail.serverName || '',
        versionName: detail.versionName || '',
        posLic: detail.posLic ?? 0,
        boLic: detail.boLic ?? 0,
        isSmartKart: detail.isSmartKart ?? false,
        versionId: detail.versionId ?? 0,
        apiurl: detail.apiurl || '',
      });
    } catch (err: any) {
      setToast({ message: err || 'Failed to load customer details', type: 'error' });
      setShowModal(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const dto: UpdateRegistrationDto = { ...formData, registrationId: editingId };
        await dispatch(updateRegistration({ id: editingId, dto })).unwrap();
        setToast({ message: 'Customer updated successfully', type: 'success' });
      } else {
        await dispatch(createRegistration(formData)).unwrap();
        setToast({ message: 'Customer created successfully', type: 'success' });
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setToast({ message: err || 'Operation failed', type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await dispatch(deleteRegistration(id)).unwrap();
      setToast({ message: 'Customer deleted successfully', type: 'success' });
      setShowDeleteConfirm(null);
      loadData();
    } catch (err: any) {
      setToast({ message: err || 'Delete failed', type: 'error' });
      setShowDeleteConfirm(null);
    }
  };

  const totalPages = Math.ceil(totalRecords / pageSize);

  const checkbox = (key: keyof CreateRegistrationDto, label: string) => (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300 select-none">
      <input
        type="checkbox"
        checked={!!formData[key]}
        onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500"
      />
      {label}
    </label>
  );

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage customer registrations including store details, licensing, and contact information.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search customers..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="w-full sm:w-72 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Customer
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Store Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Database</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Phone</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">License Expires</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Sales Person</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : registrations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <p>No customers found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                registrations.map((r) => {
                  const s = statusLabel(r.status);
                  return (
                    <tr key={r.registrationId} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">{r.storeName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{r.dataBaseName}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.email || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.phone || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.licenseExpires || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.salesPerson || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${s.cls}`}>{s.text}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => openEditModal(r)} className="text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300" title="Edit">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => setShowDeleteConfirm(r.registrationId)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Delete">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalRecords > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalRecords)} of {totalRecords}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700">Prev</button>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? 'Edit Customer' : 'Add Customer'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {loadingDetail ? (
              <div className="p-10 flex justify-center items-center text-gray-500 dark:text-gray-400">
                <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                Loading customer details...
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {/* Store Info */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">Store Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Store Name *</label>
                    <input type="text" required value={formData.storeName} onChange={(e) => setFormData({ ...formData, storeName: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Database Name *</label>
                    <input type="text" required value={formData.dataBaseName} onChange={(e) => setFormData({ ...formData, dataBaseName: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>User Name *</label>
                    <input type="text" required value={formData.userName} onChange={(e) => setFormData({ ...formData, userName: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Password *</label>
                    <input type="text" required value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Store Type</label>
                    <input type="number" value={formData.storeType} onChange={(e) => setFormData({ ...formData, storeType: parseInt(e.target.value) || 0 })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>License Expires *</label>
                    <input type="date" required value={formData.licenseExpires} onChange={(e) => setFormData({ ...formData, licenseExpires: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Server Name</label>
                    <input type="text" value={formData.serverName || ''} onChange={(e) => setFormData({ ...formData, serverName: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Status</label>
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: parseInt(e.target.value) })} className={inputCls}>
                      <option value={1}>Active</option>
                      <option value={0}>Inactive</option>
                      <option value={2}>Deleted</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">Contact Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Email</label>
                    <input type="email" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input type="text" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Fax</label>
                    <input type="text" value={formData.fax || ''} onChange={(e) => setFormData({ ...formData, fax: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Sales Person</label>
                    <input type="text" value={formData.salesPerson || ''} onChange={(e) => setFormData({ ...formData, salesPerson: e.target.value })} className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Address</label>
                    <input type="text" value={formData.address || ''} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>City/State/Zip</label>
                    <input type="text" value={formData.cityStateZip || ''} onChange={(e) => setFormData({ ...formData, cityStateZip: e.target.value })} className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">Features</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {checkbox('multipleLocation', 'Multiple Location')}
                  {checkbox('phoneOrder', 'Phone Order')}
                  {checkbox('loyalty', 'Loyalty')}
                  {checkbox('emailService', 'Email Service')}
                  {checkbox('textService', 'Text Service')}
                  {checkbox('giftCards', 'Gift Cards')}
                  {checkbox('timeAttendance', 'Time Attendance')}
                  {checkbox('isSmartKart', 'Is SmartKart')}
                </div>
              </div>

              {/* Licensing & Version */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">Licensing & Version</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>POS Licenses</label>
                    <input type="number" value={formData.posLic ?? 0} onChange={(e) => setFormData({ ...formData, posLic: parseInt(e.target.value) || 0 })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>BO Licenses</label>
                    <input type="number" value={formData.boLic ?? 0} onChange={(e) => setFormData({ ...formData, boLic: parseInt(e.target.value) || 0 })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Version ID</label>
                    <input type="number" value={formData.versionId ?? 0} onChange={(e) => setFormData({ ...formData, versionId: parseInt(e.target.value) || 0 })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Version Name</label>
                    <input type="text" value={formData.versionName || ''} onChange={(e) => setFormData({ ...formData, versionName: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Reg User</label>
                    <input type="text" value={formData.regUser || ''} onChange={(e) => setFormData({ ...formData, regUser: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>API URL</label>
                    <input type="text" value={formData.apiurl || ''} onChange={(e) => setFormData({ ...formData, apiurl: e.target.value })} className={inputCls} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
                  {saving && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>}
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Customer</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">Are you sure you want to delete this customer? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} disabled={saving}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
                {saving && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersPage;
