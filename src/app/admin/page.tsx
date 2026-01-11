'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getPipelineName } from '@/lib/pipelines';
import Header from '@/components/Header';

interface Case {
  id: string;
  customer_name: string;
  customer_email: string;
  pipeline: string;
  records_count: number;
  uploaded_at: string;
  status: string;
  estimated_cost_per_page?: number;
  cost_per_page?: number;
  actual_cost?: number;
  cost_breakdown?: {
    extraction_cost: number;
    analysis_cost: number;
    total_cost: number;
    total_tokens: number;
    extraction_model: string;
    analysis_model: string;
  };
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
      const response = await fetch('http://localhost:8001/admin/cases');
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
    };

    const labels = {
      processing: 'Processing',
      pending_review: 'Pending',
      approved: 'Approved',
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
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-gray-900 text-center">Loading cases...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto p-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Job Management Dashboard
          </h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="text-gray-600 text-sm font-medium mb-1">Total Cases</div>
            <div className="text-3xl font-bold text-gray-900">{cases.length}</div>
          </div>
          <div className="bg-white border border-yellow-200 rounded-lg p-6 shadow-sm">
            <div className="text-yellow-700 text-sm font-medium mb-1">Pending Review</div>
            <div className="text-3xl font-bold text-gray-900">
              {cases.filter(c => c.status === 'pending_review').length}
            </div>
          </div>
          <div className="bg-white border border-green-200 rounded-lg p-6 shadow-sm">
            <div className="text-green-700 text-sm font-medium mb-1">Approved</div>
            <div className="text-3xl font-bold text-gray-900">
              {cases.filter(c => c.status === 'approved').length}
            </div>
          </div>
        </div>

        {/* Cases Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Case ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Customer</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Analysis Package</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Records</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Cost/Page</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Uploaded</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Action</th>
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
                        <Link href={`/admin/review/${case_.id}/enhanced`}>
                          <code className="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded cursor-pointer hover:bg-gray-200 transition-colors">
                            {case_.id}
                          </code>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {case_.customer_name}
                        </div>
                        <div className="text-sm text-gray-500">{case_.customer_email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">
                          {getPipelineName((case_ as any).pipeline || (case_ as any).domain)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">{case_.records_count}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-700 font-medium">
                            ${(case_.cost_per_page && case_.cost_per_page > 0 ? case_.cost_per_page : case_.estimated_cost_per_page || 0.15).toFixed(4)}
                          </span>
                          {case_.cost_per_page && case_.cost_per_page > 0 ? (
                            <span className="text-xs text-green-600 font-medium">
                              actual
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">
                              estimated
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(case_.status)}</td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">
                          {formatDate(case_.uploaded_at)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/review/${case_.id}/enhanced`}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
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

      </div>
    </div>
  );
}
