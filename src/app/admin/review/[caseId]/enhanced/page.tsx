'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  AlertCircle,
  FileText,
  ArrowLeft,
  Clock,
  AlertTriangle,
  Activity,
  User,
  MessageCircle,
  Download
} from 'lucide-react';
import { getPipelineName } from '@/lib/pipelines';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Case {
  id: string;
  customer_name: string;
  pipeline: string;
  records_count: number;
  uploaded_at: string;
  status: string;
  analysis: Record<string, any>;
  edits?: Record<string, any>;
  comments?: { [section: string]: { [index: number]: string } };
  original_records?: any[];
}

interface StructuredContradiction {
  description: string;
  records: string[];
  category?: string;
  severity?: 'critical' | 'moderate' | 'minor';
  legal_relevance: 'high' | 'medium' | 'low';
}

interface StructuredRedFlag {
  category: string;
  issue: string;
  records: string[];
  legal_relevance: 'high' | 'medium' | 'low';
}

interface StructuredExpertOpinion {
  topic: string;
  records: string[];
  reason: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function isStructuredArray(arr: any[]): boolean {
  return arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null;
}

function getLegalRelevanceBadgeColor(relevance: string): string {
  switch (relevance?.toLowerCase()) {
    case 'high':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'medium':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getSeverityBadgeColor(severity?: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'moderate':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'minor':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EnhancedCaseReview() {
  const params = useParams();
  const caseId = params.caseId as string;

  const [case_, setCase] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLegalRelevance, setSelectedLegalRelevance] = useState<Set<string>>(
    new Set(['high', 'medium', 'low'])
  );
  const [comments, setComments] = useState<{ [section: string]: { [index: number]: string } }>({});
  const [commentModalData, setCommentModalData] = useState<{section: string, index: number, currentComment: string} | null>(null);
  const [viewSourceModalData, setViewSourceModalData] = useState<{recordId: string, record: any} | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    fetchCase();
  }, [caseId]);

  const fetchCase = async () => {
    try {
      const response = await fetch(`http://localhost:8001/admin/case/${caseId}`);
      const data = await response.json();

      if (data.status === 'success') {
        setCase(data.case);
        setComments(data.case.comments || {});
      } else {
        setError(data.error || 'Failed to load case');
      }
    } catch (err) {
      setError('Failed to connect to backend');
    } finally {
      setLoading(false);
    }
  };

  const saveComments = async () => {
    setSaving(true);
    setSaveMessage('');

    try {
      const response = await fetch('http://localhost:8001/admin/update-edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          edits: case_?.edits || case_?.analysis,
          comments: comments,
        }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        setSaveMessage('Comments saved successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setError(data.error || 'Failed to save comments');
      }
    } catch (err) {
      setError('Failed to save comments');
    } finally {
      setSaving(false);
    }
  };

  const downloadPDF = () => {
    window.open(`http://localhost:8001/admin/export-pdf/${caseId}`, '_blank');
  };

  const getComment = (section: string, index: number): string => {
    return comments[section]?.[index] || '';
  };

  const hasComment = (section: string, index: number): boolean => {
    return !!comments[section]?.[index];
  };

  const openCommentModal = (section: string, index: number) => {
    const currentComment = getComment(section, index);
    setCommentModalData({ section, index, currentComment });
  };

  const saveComment = (section: string, index: number, comment: string) => {
    const newComments = { ...comments };
    if (!newComments[section]) {
      newComments[section] = {};
    }
    if (comment.trim()) {
      newComments[section][index] = comment;
    } else {
      // Remove comment if empty
      delete newComments[section][index];
      if (Object.keys(newComments[section]).length === 0) {
        delete newComments[section];
      }
    }
    setComments(newComments);
    setCommentModalData(null);
  };

  const openSourceModal = (recordId: string) => {
    if (!case_?.original_records) {
      alert('Original source records not available for this case');
      return;
    }

    const record = case_.original_records.find((r: any) => r.record_id === recordId || r.id === recordId);
    if (!record) {
      alert(`Record ${recordId} not found`);
      return;
    }

    setViewSourceModalData({ recordId, record });
  };

  const formatKey = (key: string): string => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  // ============================================================================
  // FILTERING & SEARCH
  // ============================================================================

  const filteredSections = useMemo(() => {
    if (!case_?.analysis) return {};

    const filtered: Record<string, any[]> = {};
    const searchLower = searchTerm.toLowerCase();

    Object.entries(case_.analysis).forEach(([key, value]) => {
      if (!Array.isArray(value)) return;

      let items = value;

      // Apply legal relevance filter if structured
      if (isStructuredArray(items)) {
        items = items.filter((item: any) => {
          const relevance = item.legal_relevance?.toLowerCase();
          return !relevance || selectedLegalRelevance.has(relevance);
        });
      }

      // Apply search filter
      if (searchTerm) {
        items = items.filter((item: any) => {
          const searchableText = typeof item === 'string' 
            ? item 
            : JSON.stringify(item);
          return searchableText.toLowerCase().includes(searchLower);
        });
      }

      if (items.length > 0) {
        filtered[key] = items;
      }
    });

    return filtered;
  }, [case_, searchTerm, selectedLegalRelevance]);

  const toggleLegalRelevance = (level: string) => {
    const newSet = new Set(selectedLegalRelevance);
    if (newSet.has(level)) {
      newSet.delete(level);
    } else {
      newSet.add(level);
    }
    setSelectedLegalRelevance(newSet);
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderRecordBadges = (records: string[] | string) => {
    if (!records) return null;

    // Ensure records is always an array
    const recordsArray = Array.isArray(records) ? records : [records];
    if (recordsArray.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1.5">
        {recordsArray.map((record, idx) => (
          <button
            key={idx}
            onClick={() => openSourceModal(String(record))}
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer"
            title="Click to view source record"
          >
            <FileText className="w-3 h-3 mr-1" />
            {String(record)}
          </button>
        ))}
      </div>
    );
  };

  const renderContradiction = (item: StructuredContradiction, idx: number, sectionKey: string) => (
    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <AlertCircle className="w-5 h-5 text-red-500" />
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-gray-900 leading-relaxed">{item.description}</p>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            {item.category && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                {item.category}
              </span>
            )}
            {item.severity && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${getSeverityBadgeColor(item.severity)}`}>
                {item.severity}
              </span>
            )}
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold border ${getLegalRelevanceBadgeColor(item.legal_relevance)}`}>
              {item.legal_relevance?.toUpperCase() || 'N/A'}
            </span>
          </div>

          {renderRecordBadges(item.records)}

          {hasComment(sectionKey, idx) && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm mt-2">
              <div className="flex items-start gap-2">
                <MessageCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-purple-700 mb-1 text-xs">Expert Comment:</div>
                  <div className="text-gray-700 whitespace-pre-wrap">{getComment(sectionKey, idx)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => openCommentModal(sectionKey, idx)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            hasComment(sectionKey, idx)
              ? 'bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200'
              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
          }`}
          title={hasComment(sectionKey, idx) ? 'Edit comment' : 'Add comment'}
        >
          <MessageCircle className="w-4 h-4 inline mr-1" />
          {hasComment(sectionKey, idx) ? `${getComment(sectionKey, idx).length > 0 ? '1' : ''}` : ''}
        </button>
      </div>
    </div>
  );

  const renderRedFlag = (item: StructuredRedFlag, idx: number, sectionKey: string) => (
    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
              {item.category}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold border ${getLegalRelevanceBadgeColor(item.legal_relevance)}`}>
              {item.legal_relevance?.toUpperCase() || 'N/A'}
            </span>
          </div>

          <p className="text-gray-900 leading-relaxed">{item.issue}</p>

          {renderRecordBadges(item.records)}

          {hasComment(sectionKey, idx) && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm mt-2">
              <div className="flex items-start gap-2">
                <MessageCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-purple-700 mb-1 text-xs">Expert Comment:</div>
                  <div className="text-gray-700 whitespace-pre-wrap">{getComment(sectionKey, idx)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => openCommentModal(sectionKey, idx)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            hasComment(sectionKey, idx)
              ? 'bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200'
              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
          }`}
          title={hasComment(sectionKey, idx) ? 'Edit comment' : 'Add comment'}
        >
          <MessageCircle className="w-4 h-4 inline mr-1" />
          {hasComment(sectionKey, idx) ? `${getComment(sectionKey, idx).length > 0 ? '1' : ''}` : ''}
        </button>
      </div>
    </div>
  );

  const renderExpertOpinion = (item: StructuredExpertOpinion, idx: number, sectionKey: string) => (
    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <User className="w-5 h-5 text-blue-500" />
        </div>
        <div className="flex-1 space-y-2">
          <h4 className="text-sm font-semibold text-gray-900">{item.topic}</h4>
          <p className="text-sm text-gray-600 leading-relaxed">{item.reason}</p>
          {renderRecordBadges(item.records)}

          {hasComment(sectionKey, idx) && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm mt-2">
              <div className="flex items-start gap-2">
                <MessageCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-purple-700 mb-1 text-xs">Expert Comment:</div>
                  <div className="text-gray-700 whitespace-pre-wrap">{getComment(sectionKey, idx)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => openCommentModal(sectionKey, idx)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            hasComment(sectionKey, idx)
              ? 'bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200'
              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
          }`}
          title={hasComment(sectionKey, idx) ? 'Edit comment' : 'Add comment'}
        >
          <MessageCircle className="w-4 h-4 inline mr-1" />
          {hasComment(sectionKey, idx) ? `${getComment(sectionKey, idx).length > 0 ? '1' : ''}` : ''}
        </button>
      </div>
    </div>
  );

  const renderChronologyItem = (item: string, idx: number, sectionKey: string) => (
    <div key={idx} className="bg-white border-l-4 border-blue-500 pl-4 py-3">
      <div className="flex items-start gap-3">
        <p className="flex-1 text-sm text-gray-700 leading-relaxed">{item}</p>
        <button
          onClick={() => openCommentModal(sectionKey, idx)}
          className={`flex-shrink-0 px-2 py-1 rounded text-xs font-medium transition-colors ${
            hasComment(sectionKey, idx)
              ? 'bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200'
              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
          }`}
          title={hasComment(sectionKey, idx) ? 'Edit comment' : 'Add comment'}
        >
          <MessageCircle className="w-3 h-3 inline" />
        </button>
      </div>
      {hasComment(sectionKey, idx) && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 text-xs mt-2">
          <div className="flex items-start gap-2">
            <MessageCircle className="w-3 h-3 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-purple-700 mb-1">Expert Comment:</div>
              <div className="text-gray-700 whitespace-pre-wrap">{getComment(sectionKey, idx)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderStringItem = (item: string, idx: number, sectionKey: string) => (
    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <p className="flex-1 text-sm text-gray-700 leading-relaxed">{item}</p>
        <button
          onClick={() => openCommentModal(sectionKey, idx)}
          className={`flex-shrink-0 px-2 py-1 rounded text-xs font-medium transition-colors ${
            hasComment(sectionKey, idx)
              ? 'bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200'
              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
          }`}
          title={hasComment(sectionKey, idx) ? 'Edit comment' : 'Add comment'}
        >
          <MessageCircle className="w-3 h-3 inline" />
        </button>
      </div>
      {hasComment(sectionKey, idx) && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 text-xs mt-2">
          <div className="flex items-start gap-2">
            <MessageCircle className="w-3 h-3 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-purple-700 mb-1">Expert Comment:</div>
              <div className="text-gray-700 whitespace-pre-wrap">{getComment(sectionKey, idx)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderGenericStructuredItem = (item: any, idx: number, sectionKey: string) => (
    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <Activity className="w-5 h-5 text-gray-600" />
        </div>
        <div className="flex-1 space-y-2">
          {/* Display main text fields */}
          {Object.entries(item).map(([key, value]) => {
            // Skip records array and metadata fields for main display
            if (key === 'records' || key === 'legal_relevance' || key === 'category' || key === 'severity') return null;

            // Handle different value types
            let displayValue: string;
            if (Array.isArray(value)) {
              displayValue = value.join(', ');
            } else if (typeof value === 'object' && value !== null) {
              displayValue = JSON.stringify(value);
            } else {
              displayValue = String(value || '');
            }

            return (
              <div key={key}>
                <p className="text-sm font-medium text-gray-500 capitalize">{key.replace(/_/g, ' ')}</p>
                <p className="text-gray-900 leading-relaxed">{displayValue}</p>
              </div>
            );
          })}

          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {item.category && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                {item.category}
              </span>
            )}
            {item.severity && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${getSeverityBadgeColor(item.severity)}`}>
                {item.severity}
              </span>
            )}
            {item.legal_relevance && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold border ${getLegalRelevanceBadgeColor(item.legal_relevance)}`}>
                {item.legal_relevance?.toUpperCase() || 'N/A'}
              </span>
            )}
          </div>

          {/* Record badges */}
          {item.records && renderRecordBadges(item.records)}

          {hasComment(sectionKey, idx) && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm mt-2">
              <div className="flex items-start gap-2">
                <MessageCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-purple-700 mb-1 text-xs">Expert Comment:</div>
                  <div className="text-gray-700 whitespace-pre-wrap">{getComment(sectionKey, idx)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => openCommentModal(sectionKey, idx)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            hasComment(sectionKey, idx)
              ? 'bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200'
              : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
          }`}
          title={hasComment(sectionKey, idx) ? 'Edit comment' : 'Add comment'}
        >
          <MessageCircle className="w-4 h-4 inline mr-1" />
          {hasComment(sectionKey, idx) ? `${getComment(sectionKey, idx).length > 0 ? '1' : ''}` : ''}
        </button>
      </div>
    </div>
  );

  const renderSection = (sectionKey: string, items: any[]) => {
    if (items.length === 0) return null;

    const isStructured = isStructuredArray(items);
    const sectionTitle = sectionKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    let icon = <Activity className="w-5 h-5" />;
    if (sectionKey === 'chronology') icon = <Clock className="w-5 h-5" />;
    if (sectionKey === 'contradictions') icon = <AlertCircle className="w-5 h-5" />;
    if (sectionKey === 'red_flags') icon = <AlertTriangle className="w-5 h-5" />;
    if (sectionKey === 'expert_opinions_needed') icon = <User className="w-5 h-5" />;

    return (
      <section key={sectionKey} className="space-y-3">
        <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
          {icon}
          <h2 className="text-lg font-semibold text-gray-900">{sectionTitle}</h2>
          <span className="ml-auto text-sm font-medium text-gray-500">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        

        <div className="space-y-2">
          {items.map((item, idx) => {
            if (sectionKey === 'contradictions' && isStructured) {
              return renderContradiction(item as StructuredContradiction, idx, sectionKey);
            }
            if (sectionKey === 'red_flags' && isStructured) {
              return renderRedFlag(item as StructuredRedFlag, idx, sectionKey);
            }
            if (sectionKey === 'expert_opinions_needed' && isStructured) {
              return renderExpertOpinion(item as StructuredExpertOpinion, idx, sectionKey);
            }
            if (sectionKey === 'chronology') {
              return renderChronologyItem(item, idx, sectionKey);
            }
            // Fallback: use generic structured renderer for unknown structured types
            if (isStructured) {
              return renderGenericStructuredItem(item, idx, sectionKey);
            }
            return renderStringItem(item, idx, sectionKey);
          })}
        </div>
      </section>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading case...</p>
        </div>
      </div>
    );
  }

  if (error || !case_) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">Error Loading Case</h2>
          <p className="text-gray-600 text-center">{error || 'Unknown error'}</p>
          <Link 
            href="/admin"
            className="mt-6 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const totalFindings = Object.values(filteredSections).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Dashboard
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{case_.customer_name}</h1>
                <p className="text-sm text-gray-500">
                  {getPipelineName(case_.pipeline)} • {case_.records_count} records
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={saveComments}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Comments'}
              </button>
              <button
                onClick={downloadPDF}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </button>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Case ID: {case_.id}</p>
                <p className="text-xs text-gray-500">{case_.status}</p>
              </div>
            </div>
          </div>
          {saveMessage && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <p className="text-sm text-green-800">{saveMessage}</p>
            </div>
          )}
        </div>
      </header>

      {/* Search & Filters Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search all findings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Legal Relevance Filters */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Legal Relevance:</span>
              {['high', 'medium', 'low'].map((level) => (
                <button
                  key={level}
                  onClick={() => toggleLegalRelevance(level)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    selectedLegalRelevance.has(level)
                      ? getLegalRelevanceBadgeColor(level)
                      : 'bg-gray-100 text-gray-400 border-gray-200'
                  }`}
                >
                  {level.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Active Filters Summary */}
          {(searchTerm || selectedLegalRelevance.size < 3) && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">{totalFindings} findings</span>
              {searchTerm && (
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
                  containing "{searchTerm}"
                </span>
              )}
              {selectedLegalRelevance.size < 3 && (
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
                  {Array.from(selectedLegalRelevance).join(', ')} relevance
                </span>
              )}
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedLegalRelevance(new Set(['high', 'medium', 'low']));
                }}
                className="ml-2 text-blue-600 hover:text-blue-800 underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {Object.entries(filteredSections).length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No findings match your filters</h3>
              <p className="text-gray-600">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            Object.entries(filteredSections).map(([key, items]) => renderSection(key, items))
          )}
        </div>
      </main>

      {/* Comment Modal */}
      {commentModalData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setCommentModalData(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Expert Comment
              </h3>
              <button
                onClick={() => setCommentModalData(null)}
                className="text-white hover:text-gray-200 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-2">
                  Section: <span className="font-semibold">{commentModalData.section.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                  {' • '}
                  Item #{commentModalData.index + 1}
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 mb-4 max-h-40 overflow-y-auto">
                  {(() => {
                    const item = case_?.analysis[commentModalData.section]?.[commentModalData.index];
                    if (!item) return '(No content)';
                    if (typeof item === 'string') return item;
                    return JSON.stringify(item, null, 2);
                  })()}
                </div>
              </div>

              <label className="block mb-2 text-sm font-semibold text-gray-700">
                Expert Comment / Rationale:
              </label>
              <textarea
                value={commentModalData.currentComment}
                onChange={(e) => setCommentModalData({ ...commentModalData, currentComment: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-[120px] text-sm"
                placeholder="Explain reasoning, reference source records, note clinical judgment..."
              />

              <div className="text-xs text-gray-500 mt-2 italic">
                Tip: Reference specific records, cite clinical guidelines, or explain diagnostic reasoning
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex gap-3 justify-end">
              <button
                onClick={() => setCommentModalData(null)}
                className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => saveComment(commentModalData.section, commentModalData.index, commentModalData.currentComment)}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Save Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Source Record Modal */}
      {viewSourceModalData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setViewSourceModalData(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Source Record: {viewSourceModalData.recordId}
              </h3>
              <button
                onClick={() => setViewSourceModalData(null)}
                className="text-white hover:text-gray-200 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="overflow-y-auto p-6">
              <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                {viewSourceModalData.record ? (
                  <div className="space-y-2">
                    {Object.entries(viewSourceModalData.record).map(([key, value]) => (
                      <div key={key} className="grid grid-cols-4 gap-2">
                        <div className="col-span-1 text-sm font-semibold text-gray-700">
                          {formatKey(key)}:
                        </div>
                        <div className="col-span-3 text-sm text-gray-900 whitespace-pre-wrap break-words">
                          {formatValue(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-red-600 italic">Record not found</div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
              <button
                onClick={() => setViewSourceModalData(null)}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}