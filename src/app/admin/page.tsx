'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Case {
  id: string;
  customer_name: string;
  customer_email: string;
  pipeline: string;
  records_count: number;
  uploaded_at: string;
  status: string;
  estimated_cost_per_page?: number;
}

export default function AdminDashboard() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      const response = await fetch('http://localhost:8000/admin/cases');
      const data = await response.json();

      if (data.status === 'success') {
        setCases(data.cases);
      } else {
        setError(data.error || 'Failed to load cases');
      }
    } catch (err) {
      setError('Failed to connect to backend');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      processing: 'bg-blue-100 text-blue-800',
      pending_review: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      delivered: 'bg-gray-100 text-gray-800',
    };

    const labels = {
      processing: 'Processing',
      pending_review: 'Pending Review',
      approved: 'Approved',
      delivered: 'Delivered',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles] || styles.processing}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-white text-center">Loading cases...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            FPA Med - ChronoScope Admin
          </h1>
          <p className="text-purple-200">
            Job Management Dashboard
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-sm border border-purple-300/20 rounded-lg p-6">
            <div className="text-purple-200 text-sm font-medium mb-1">Total Cases</div>
            <div className="text-3xl font-bold text-white">{cases.length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-yellow-300/20 rounded-lg p-6">
            <div className="text-yellow-200 text-sm font-medium mb-1">Pending Review</div>
            <div className="text-3xl font-bold text-white">
              {cases.filter(c => c.status === 'pending_review').length}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-green-300/20 rounded-lg p-6">
            <div className="text-green-200 text-sm font-medium mb-1">Approved</div>
            <div className="text-3xl font-bold text-white">
              {cases.filter(c => c.status === 'approved').length}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-gray-300/20 rounded-lg p-6">
            <div className="text-gray-200 text-sm font-medium mb-1">Delivered</div>
            <div className="text-3xl font-bold text-white">
              {cases.filter(c => c.status === 'delivered').length}
            </div>
          </div>
        </div>

        {/* Cases Table */}
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-purple-600 to-blue-600">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Case ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Customer</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Analysis Package</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Records</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Cost/Page</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Uploaded</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {cases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      No cases yet. Upload documents to get started.
                    </td>
                  </tr>
                ) : (
                  cases.map((case_) => (
                    <tr key={case_.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <code className="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded">
                          {case_.id}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {case_.customer_name}
                        </div>
                        <div className="text-sm text-gray-500">{case_.customer_email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 capitalize">
                          {((case_ as any).pipeline || (case_ as any).domain || 'Unknown').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">{case_.records_count}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 font-medium">
                          ${(case_.estimated_cost_per_page || 0.15).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(case_.status)}</td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">
                          {formatDate(case_.uploaded_at)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/review/${case_.id}`}
                          className="text-purple-600 hover:text-purple-800 font-medium text-sm"
                        >
                          Review →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Back to Upload */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-purple-200 hover:text-white transition-colors"
          >
            ← Back to Upload
          </Link>
        </div>
      </div>
    </div>
  );
}
