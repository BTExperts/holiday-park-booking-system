import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Card } from './ui/card';
import { Tabs } from './ui/tabs';
import apiService from '../services/api';

const PaymentLedger = ({ paymentMethods, onClose }) => {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    paymentType: '',
    paymentMethodId: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0
  });

  const paymentTypes = [
    { value: '', label: 'All Types' },
    { value: 'deposit', label: 'Deposit' },
    { value: 'payment', label: 'Payment' },
    { value: 'refund', label: 'Refund' },
    { value: 'adjustment', label: 'Adjustment' }
  ];

  const loadPayments = async () => {
    setLoading(true);
    try {
      const queryFilters = {
        ...filters,
        limit: pagination.limit,
        offset: (pagination.page - 1) * pagination.limit
      };
      
      const [paymentsData, statsData] = await Promise.all([
        apiService.getPayments(queryFilters),
        apiService.getPaymentStats(filters)
      ]);
      
      setPayments(paymentsData);
      setStats(statsData);
      setPagination(prev => ({ ...prev, total: statsData.totalPayments }));
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [filters, pagination.page]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Date', 'Booking #', 'Client', 'Type', 'Method', 'Amount', 'Reason'],
      ...payments.map(p => [
        new Date(p.processedAt).toLocaleDateString(),
        p.bookingNumber || '',
        `${p.firstName || ''} ${p.lastName || ''}`.trim(),
        p.paymentType,
        p.paymentMethodName || '',
        p.amount.toFixed(2),
        p.reason || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${filters.startDate}-to-${filters.endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Payment Ledger</h2>
        <div className="flex gap-2">
          <Button onClick={loadPayments} variant="outline">
            Refresh
          </Button>
          <Button onClick={exportToCSV} variant="outline">
            Export CSV
          </Button>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Total Payments</div>
          <div className="text-2xl font-bold">{stats.totalPayments || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Total Amount</div>
          <div className="text-2xl font-bold">${(stats.totalAmount || 0).toFixed(2)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Total Received</div>
          <div className="text-2xl font-bold text-green-600">${(stats.totalReceived || 0).toFixed(2)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Total Refunded</div>
          <div className="text-2xl font-bold text-red-600">${(stats.totalRefunded || 0).toFixed(2)}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Payment Type</label>
            <Select
              value={filters.paymentType}
              onValueChange={(value) => handleFilterChange('paymentType', value)}
            >
              {paymentTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Payment Method</label>
            <Select
              value={filters.paymentMethodId}
              onValueChange={(value) => handleFilterChange('paymentMethodId', value)}
            >
              <option value="">All Methods</option>
              {paymentMethods.map(method => (
                <option key={method.id} value={method.id}>{method.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <Input
              placeholder="Booking # or Client name"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Payments Table */}
      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Booking #</th>
                <th className="text-left p-2">Client</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Method</th>
                <th className="text-right p-2">Amount</th>
                <th className="text-left p-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center p-4">Loading...</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center p-4">No payments found</td>
                </tr>
              ) : (
                payments.map(payment => (
                  <tr key={payment.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{new Date(payment.processedAt).toLocaleDateString()}</td>
                    <td className="p-2">{payment.bookingNumber || '-'}</td>
                    <td className="p-2">{`${payment.firstName || ''} ${payment.lastName || ''}`.trim() || '-'}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        payment.paymentType === 'refund' ? 'bg-red-100 text-red-800' :
                        payment.paymentType === 'deposit' ? 'bg-blue-100 text-blue-800' :
                        payment.paymentType === 'payment' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {payment.paymentType}
                      </span>
                    </td>
                    <td className="p-2">{payment.paymentMethodName || '-'}</td>
                    <td className={`p-2 text-right font-medium ${
                      payment.amount < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {payment.amount < 0 ? '-' : ''}${Math.abs(payment.amount).toFixed(2)}
                    </td>
                    <td className="p-2">{payment.reason || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} payments
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <Button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === totalPages}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PaymentLedger;
