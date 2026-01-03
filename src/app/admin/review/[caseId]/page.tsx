'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getPipelineName } from '@/lib/pipelines';

interface Case {
  id: string;
  customer_name: string;
  customer_email: string;
  pipeline: string;
  records_count: number;
  uploaded_at: string;
  status: string;
  analysis: any;
  edits: any;
  original_records?: any[];
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

export default function CaseReview() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;

  const [case_, setCase] = useState<Case | null>(null);
  const [edits, setEdits] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [showOnlyLowConfidence, setShowOnlyLowConfidence] = useState(false);
  const [viewSourceModalData, setViewSourceModalData] = useState<{recordIds: string[], records: any[]} | null>(null);
  const [viewMode, setViewMode] = useState<'expert' | 'ai' | 'sidebyside'>('expert');

  useEffect(() => {
    fetchCase();
  }, [caseId]);

  const fetchCase = async () => {
    try {
      const response = await fetch(`http://localhost:8001/admin/case/${caseId}`);
      const data = await response.json();

      if (data.status === 'success') {
        setCase(data.case);
        setEdits(data.case.edits || data.case.analysis);
      } else {
        setError(data.error || 'Failed to load case');
      }
    } catch (err) {
      setError('Failed to connect to backend');
    } finally {
      setLoading(false);
    }
  };

  const saveEdits = async () => {
    setSaving(true);
    setSaveMessage('');

    try {
      const response = await fetch('http://localhost:8001/admin/update-edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          edits: edits,
        }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        setSaveMessage('Edits saved successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setError(data.error || 'Failed to save edits');
      }
    } catch (err) {
      setError('Failed to save edits');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    try {
      const response = await fetch('http://localhost:8001/admin/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          status: newStatus,
        }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        // Refresh case data
        fetchCase();
        setSaveMessage(`Case marked as ${newStatus}!`);
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setError(data.error || 'Failed to update status');
      }
    } catch (err) {
      setError('Failed to update status');
    }
  };

  const downloadPDF = () => {
    window.open(`http://localhost:8001/admin/export-pdf/${caseId}`, '_blank');
  };

  const updateListItem = (section: string, index: number, value: string) => {
    const newEdits = { ...edits };
    newEdits[section][index] = value;
    setEdits(newEdits);
  };

  const removeListItem = (section: string, index: number) => {
    const newEdits = { ...edits };
    newEdits[section].splice(index, 1);
    setEdits(newEdits);
  };

  const addListItem = (section: string) => {
    const newEdits = { ...edits };
    if (!newEdits[section]) {
      newEdits[section] = [];
    }
    newEdits[section].push('');
    setEdits(newEdits);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-white text-center">Loading case...</div>
        </div>
      </div>
    );
  }

  if (error || !case_) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error || 'Case not found'}</p>
          </div>
          <div className="mt-4 text-center">
            <Link href="/admin" className="text-purple-200 hover:text-white">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

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

  const getConfidenceBadge = (confidence: string) => {
    const styles = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-red-100 text-red-800',
    };

    // If no confidence value, show "Coming Soon" with neutral styling
    if (!confidence) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 text-center">
          Conf Rate<br />Coming Soon
        </span>
      );
    }

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[confidence as keyof typeof styles] || styles.medium}`}>
        {confidence}
      </span>
    );
  };

  const extractConfidenceFromText = (text: string): { text: string; confidence: string } => {
    const confidenceMatch = text.match(/\[Confidence:\s*(high|medium|low)\]/i);
    if (confidenceMatch) {
      return {
        text: text.replace(/\[Confidence:\s*(high|medium|low)\]/i, '').trim(),
        confidence: confidenceMatch[1].toLowerCase()
      };
    }
    return { text, confidence: '' };  // Return empty string when no confidence found
  };

  const openSourceModal = (recordIds: string[]) => {
    if (!case_?.original_records) {
      alert('Original source records not available for this case');
      return;
    }

    // Find the full record objects for these IDs
    const sourceRecords = recordIds.map(id => {
      const record = case_.original_records?.find((r: any) => r.record_id === id || r.id === id);
      return record || { record_id: id, error: 'Record not found' };
    });

    setViewSourceModalData({ recordIds, records: sourceRecords });
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

  const calculateEditMetrics = () => {
    if (!case_?.analysis || !case_?.edits) {
      return null;
    }

    let totalAI = 0;
    let unchanged = 0;
    let edited = 0;
    let removed = 0;
    let added = 0;

    Object.keys(case_.analysis).forEach(section => {
      if (!Array.isArray(case_.analysis[section])) return;

      const aiItems = case_.analysis[section];
      const editItems = case_.edits[section] || [];

      totalAI += aiItems.length;

      aiItems.forEach((aiItem, idx) => {
        if (!editItems[idx]) {
          removed++; // Item was deleted
        } else if (aiItem === editItems[idx]) {
          unchanged++; // Identical
        } else {
          edited++; // Modified
        }
      });

      // Count additions (items beyond original length)
      if (editItems.length > aiItems.length) {
        added += editItems.length - aiItems.length;
      }
    });

    const enhancementRate = totalAI > 0
      ? Math.round(((edited + removed + added) / totalAI) * 100)
      : 0;

    return { totalAI, unchanged, edited, removed, added, enhancementRate };
  };

  const getItemChangeStatus = (section: string, index: number): 'unchanged' | 'edited' | 'removed' | 'added' => {
    if (!case_?.analysis || !case_?.edits) return 'unchanged';

    const aiItems = case_.analysis[section] || [];
    const editItems = case_.edits[section] || [];

    // Item was added by expert (beyond AI's original length)
    if (index >= aiItems.length) return 'added';

    // Item was removed by expert
    if (!editItems[index]) return 'removed';

    // Item was edited
    if (aiItems[index] !== editItems[index]) return 'edited';

    // Item unchanged
    return 'unchanged';
  };

  const filterItemsByConfidence = (items: string[]) => {
    if (!showOnlyLowConfidence) return items;
    return items.filter(item => {
      const { confidence } = extractConfidenceFromText(item);
      return confidence === 'low';
    });
  };

  const getSectionTitle = (key: string) => {
    const titles: { [key: string]: string } = {
      // Common sections
      timeline: 'Timeline',
      treatment_gaps: 'Treatment Gaps',

      // Compliance tier
      medication_adherence: 'Medication Adherence',
      safety_documentation: 'Safety Documentation',
      consent_issues: 'Consent Issues',

      // Expert witness tier
      contradictions: 'Contradictions',
      standard_of_care_deviations: 'Standard of Care Deviations',
      competency_timeline: 'Competency Timeline',
      expert_opinions_needed: 'Expert Opinions Needed',

      // Full discovery tier
      functional_capacity_timeline: 'Functional Capacity Timeline',
      suicide_violence_risk_assessment: 'Suicide/Violence Risk Assessment',
      substance_use_impact: 'Substance Use Impact',
      legal_psychiatric_interface: 'Legal-Psychiatric Interface',
      causation_analysis: 'Causation Analysis',
      damages_assessment: 'Damages Assessment',

      // Medical chronology sections
      chronology: 'Medical Chronology',
      missing_records: 'Missing Records / Care Gaps',
      red_flags: 'Red Flags',
    };
    return titles[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getSectionColor = (key: string) => {
    const colors: { [key: string]: string } = {
      // Common sections
      timeline: 'border-blue-300 bg-blue-50',
      treatment_gaps: 'border-red-300 bg-red-50',

      // Compliance tier
      medication_adherence: 'border-purple-300 bg-purple-50',
      safety_documentation: 'border-red-300 bg-red-50',
      consent_issues: 'border-orange-300 bg-orange-50',

      // Expert witness tier
      contradictions: 'border-amber-300 bg-amber-50',
      standard_of_care_deviations: 'border-red-300 bg-red-50',
      competency_timeline: 'border-indigo-300 bg-indigo-50',
      expert_opinions_needed: 'border-yellow-300 bg-yellow-50',

      // Full discovery tier
      functional_capacity_timeline: 'border-blue-300 bg-blue-50',
      suicide_violence_risk_assessment: 'border-red-300 bg-red-50',
      substance_use_impact: 'border-purple-300 bg-purple-50',
      legal_psychiatric_interface: 'border-gray-300 bg-gray-50',
      causation_analysis: 'border-green-300 bg-green-50',
      damages_assessment: 'border-blue-300 bg-blue-50',

      // Medical chronology sections
      chronology: 'border-blue-300 bg-blue-50',
      missing_records: 'border-orange-300 bg-orange-50',
      red_flags: 'border-red-300 bg-red-50',
    };
    return colors[key] || 'border-gray-300 bg-gray-50';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin" className="text-purple-200 hover:text-white mb-4 inline-block">
            ← Back to Dashboard
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Case Review
              </h1>
              <p className="text-purple-200 mb-2">
                {case_.customer_name} - {getPipelineName((case_ as any).pipeline || (case_ as any).domain)}
              </p>
              <code className="text-sm text-purple-300 bg-white/10 px-2 py-1 rounded">
                {case_.id}
              </code>
            </div>
            <div>{getStatusBadge(case_.status)}</div>
          </div>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">{saveMessage}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-6 bg-white rounded-xl shadow-lg p-6">
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={saveEdits}
              disabled={saving}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Edits'}
            </button>

            <button
              onClick={downloadPDF}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Download PDF
            </button>

            {case_.status === 'pending_review' && (
              <button
                onClick={() => updateStatus('approved')}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                Approve Case
              </button>
            )}

            {case_.status === 'approved' && (
              <button
                onClick={() => updateStatus('delivered')}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
              >
                Mark as Delivered
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 mr-2">View Mode:</span>
              <button
                onClick={() => setViewMode('ai')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'ai'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                AI Original
              </button>
              <button
                onClick={() => setViewMode('expert')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'expert'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Expert Version
              </button>
              <button
                onClick={() => setViewMode('sidebyside')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'sidebyside'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Side-by-Side
              </button>
            </div>
          </div>
        </div>

        {/* Edit Metrics Summary */}
        {(() => {
          const metrics = calculateEditMetrics();
          if (!metrics) return null;

          return (
            <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl shadow-lg p-6">
              <div className="flex items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">Expert Review Summary</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-2xl font-bold text-purple-600">{metrics.totalAI}</div>
                  <div className="text-sm text-gray-600">AI-Generated Findings</div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-2xl font-bold text-green-600">
                    {metrics.unchanged}
                    <span className="text-sm text-gray-500 ml-1">
                      ({metrics.totalAI > 0 ? Math.round((metrics.unchanged / metrics.totalAI) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">Validated Unchanged</div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-2xl font-bold text-blue-600">
                    {metrics.edited}
                    <span className="text-sm text-gray-500 ml-1">
                      ({metrics.totalAI > 0 ? Math.round((metrics.edited / metrics.totalAI) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">Edited by Expert</div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-2xl font-bold text-red-600">
                    {metrics.removed}
                    <span className="text-sm text-gray-500 ml-1">
                      ({metrics.totalAI > 0 ? Math.round((metrics.removed / metrics.totalAI) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">Removed by Expert</div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-2xl font-bold text-amber-600">{metrics.added}</div>
                  <div className="text-sm text-gray-600">Added by Expert</div>
                </div>

                <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-3 text-white">
                  <div className="text-2xl font-bold">{metrics.enhancementRate}%</div>
                  <div className="text-sm opacity-90">Expert Enhancement</div>
                </div>
              </div>

              <div className="text-xs text-gray-600 italic">
                Expert enhancement rate = (edited + removed + added) / total AI findings
              </div>
            </div>
          );
        })()}

        {/* Confidence Filter Toggle */}
        {edits && Object.keys(edits).some(key => ['chronology', 'missing_records', 'red_flags'].includes(key)) && (
          <div className="mb-6 bg-white rounded-xl shadow-lg p-4">
            <button
              onClick={() => setShowOnlyLowConfidence(!showOnlyLowConfidence)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                showOnlyLowConfidence
                  ? 'bg-red-100 text-red-800 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {showOnlyLowConfidence ? '✓ Showing Low Confidence Only' : 'Show Low Confidence Only'}
            </button>
            <span className="ml-3 text-sm text-gray-600">
              Filter to show only items that need review
            </span>
          </div>
        )}

        {/* Sections Display - Mode Aware */}
        <div className="space-y-6">
          {viewMode === 'sidebyside' ? (
            // Side-by-Side Comparison View
            Object.keys(edits).map((section) => {
              if (!Array.isArray(edits[section])) return null;

              const aiItems = case_.analysis?.[section] || [];
              const expertItems = edits[section] || [];
              const maxLength = Math.max(aiItems.length, expertItems.length);

              return (
                <div
                  key={section}
                  className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 ${getSectionColor(section)}`}
                >
                  <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
                    <h2 className="text-xl font-bold text-white">
                      {getSectionTitle(section)}
                    </h2>
                  </div>

                  <div className="p-6">
                    {/* Side-by-Side Headers */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="font-bold text-gray-700 text-center">AI Generated ({aiItems.length})</div>
                      <div className="font-bold text-purple-700 text-center">Expert Reviewed ({expertItems.length})</div>
                    </div>

                    {/* Side-by-Side Items */}
                    <div className="space-y-4">
                      {Array.from({ length: maxLength }).map((_, idx) => {
                        const aiItem = aiItems[idx];
                        const expertItem = expertItems[idx];
                        const changeStatus = getItemChangeStatus(section, idx);

                        return (
                          <div key={idx} className="grid grid-cols-2 gap-4">
                            {/* AI Side */}
                            <div className={`p-3 rounded-lg border-2 ${
                              changeStatus === 'removed'
                                ? 'bg-red-50 border-red-200'
                                : 'bg-gray-50 border-gray-200'
                            }`}>
                              {aiItem ? (
                                <div className={changeStatus === 'removed' ? 'line-through text-gray-400' : 'text-gray-700'}>
                                  <span className="text-xs font-bold text-gray-500">#{idx + 1}</span>
                                  <div className="text-sm mt-1">{aiItem}</div>
                                </div>
                              ) : (
                                <div className="text-gray-400 italic text-sm text-center py-4">
                                  (Not in AI version)
                                </div>
                              )}
                            </div>

                            {/* Expert Side */}
                            <div className={`p-3 rounded-lg border-2 ${
                              changeStatus === 'added'
                                ? 'bg-green-50 border-green-300'
                                : changeStatus === 'edited'
                                ? 'bg-blue-50 border-blue-300'
                                : changeStatus === 'removed'
                                ? 'bg-gray-100 border-gray-300'
                                : 'bg-white border-gray-200'
                            }`}>
                              {changeStatus === 'removed' ? (
                                <div className="text-gray-500 italic text-sm text-center py-4">
                                  [REMOVED BY EXPERT]
                                </div>
                              ) : expertItem ? (
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-gray-500">#{idx + 1}</span>
                                    {changeStatus === 'added' && (
                                      <span className="text-xs font-semibold text-green-600">ADDED</span>
                                    )}
                                    {changeStatus === 'edited' && (
                                      <span className="text-xs font-semibold text-blue-600">EDITED</span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-700">{expertItem}</div>
                                </div>
                              ) : (
                                <div className="text-gray-400 italic text-sm text-center py-4">
                                  (Empty)
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            // Single Column View (AI Original or Expert Version)
            Object.keys(viewMode === 'ai' ? (case_.analysis || {}) : edits).map((section) => {
              const dataSource = viewMode === 'ai' ? case_.analysis : edits;
              if (!Array.isArray(dataSource[section])) return null;

              const filteredItems = filterItemsByConfidence(dataSource[section]);
              const displayItems = showOnlyLowConfidence ? filteredItems : dataSource[section];
              const isReadOnly = viewMode === 'ai';

              return (
                <div
                  key={section}
                  className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 ${getSectionColor(section)} ${isReadOnly ? 'opacity-90' : ''}`}
                >
                  <div className={`px-6 py-4 flex items-center justify-between ${
                    isReadOnly
                      ? 'bg-gradient-to-r from-gray-600 to-gray-700'
                      : 'bg-gradient-to-r from-purple-600 to-blue-600'
                  }`}>
                    <h2 className="text-xl font-bold text-white">
                      {getSectionTitle(section)} ({dataSource[section].length})
                      {isReadOnly && <span className="ml-2 text-sm font-normal opacity-75">(AI Original - Read Only)</span>}
                      {showOnlyLowConfidence && filteredItems.length !== dataSource[section].length && (
                        <span className="ml-2 text-sm font-normal opacity-90">
                          - Showing {filteredItems.length} low confidence items
                        </span>
                      )}
                    </h2>
                    {!isReadOnly && case_.original_records && case_.original_records.length > 0 && (
                      <button
                        onClick={() => {
                          const allRecordIds = case_.original_records?.map((r: any) => r.record_id || r.id || 'Unknown') || [];
                          openSourceModal(allRecordIds);
                        }}
                        className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                      >
                        <span>📄</span>
                        <span>View All Source Records ({case_.original_records.length})</span>
                      </button>
                    )}
                  </div>

                  <div className="p-6 space-y-4">
                    {displayItems.length === 0 && showOnlyLowConfidence ? (
                      <div className="text-center py-8 text-gray-500">
                        No low confidence items in this section
                      </div>
                    ) : (
                      displayItems.map((item: string) => {
                        const actualIndex = dataSource[section].indexOf(item);
                        const { confidence } = extractConfidenceFromText(item);

                        return (
                          <div key={actualIndex} className="flex gap-2">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm ${
                              isReadOnly ? 'bg-gray-200 text-gray-600' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {actualIndex + 1}
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start gap-2">
                                {isReadOnly ? (
                                  <div className="flex-1 p-3 bg-gray-50 border border-gray-300 rounded-lg min-h-[80px] font-mono text-sm text-gray-700">
                                    {item}
                                  </div>
                                ) : (
                                  <textarea
                                    value={item}
                                    onChange={(e) => updateListItem(section, actualIndex, e.target.value)}
                                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-[80px] font-mono text-sm"
                                  />
                                )}
                                {getConfidenceBadge(confidence)}
                              </div>
                            {/* Per-finding source lineage (only shows if DocETL lineage tracking is enabled) */}
                            {case_.analysis && (case_.analysis as any).forensic_audit_lineage && (
                              <div className="text-xs bg-gray-50 px-3 py-2 rounded border border-gray-200 flex items-center justify-between">
                                <div className="text-gray-500">
                                  <span className="font-semibold">Source records: </span>
                                  {(case_.analysis as any).forensic_audit_lineage[actualIndex]?.join(', ') || 'N/A'}
                                </div>
                                {case_.original_records && (case_.analysis as any).forensic_audit_lineage[actualIndex]?.length > 0 && (
                                  <button
                                    onClick={() => openSourceModal((case_.analysis as any).forensic_audit_lineage[actualIndex])}
                                    className="ml-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
                                  >
                                    View Source →
                                  </button>
                                )}
                              </div>
                            )}
                            </div>
                            {!isReadOnly && (
                              <button
                                onClick={() => removeListItem(section, actualIndex)}
                                className="flex-shrink-0 w-8 h-8 bg-red-100 hover:bg-red-200 text-red-700 rounded-full flex items-center justify-center transition-colors"
                                title="Remove item"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}

                    {!isReadOnly && (
                      <button
                        onClick={() => addListItem(section)}
                        className="w-full py-3 border-2 border-dashed border-gray-300 hover:border-purple-400 text-gray-600 hover:text-purple-600 rounded-lg transition-colors font-medium"
                      >
                        + Add {getSectionTitle(section)} Item
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Case Info */}
        <div className="mt-8 bg-white/10 backdrop-blur-sm border border-purple-300/20 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Case Information</h3>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-purple-200">Customer Email</dt>
              <dd className="text-white font-medium">{case_.customer_email || 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-purple-200">Records Analyzed</dt>
              <dd className="text-white font-medium">{case_.records_count}</dd>
            </div>
            <div>
              <dt className="text-purple-200">Uploaded At</dt>
              <dd className="text-white font-medium">
                {new Date(case_.uploaded_at).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-purple-200">Analysis Package</dt>
              <dd className="text-white font-medium">
                {getPipelineName((case_ as any).pipeline || (case_ as any).domain)}
              </dd>
            </div>
            {case_.cost_breakdown && (
              <>
                <div>
                  <dt className="text-purple-200">Processing Cost</dt>
                  <dd className="text-white font-medium">
                    ${case_.actual_cost?.toFixed(4)}
                    <span className="text-purple-300 text-xs ml-2">
                      (${case_.cost_per_page?.toFixed(4)}/page)
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-purple-200">Cost Breakdown</dt>
                  <dd className="text-white font-medium text-sm">
                    <div className="space-y-1">
                      <div>Extraction: ${case_.cost_breakdown.extraction_cost?.toFixed(4)}</div>
                      <div>Analysis: ${case_.cost_breakdown.analysis_cost?.toFixed(4)}</div>
                      <div className="text-purple-300">Tokens: {case_.cost_breakdown.total_tokens?.toLocaleString()}</div>
                    </div>
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-purple-200">Models Used</dt>
                  <dd className="text-white font-medium text-sm">
                    <div className="flex gap-4">
                      <span>Extraction: <span className="text-purple-300">{case_.cost_breakdown.extraction_model}</span></span>
                      <span>Analysis: <span className="text-purple-300">{case_.cost_breakdown.analysis_model}</span></span>
                    </div>
                  </dd>
                </div>
              </>
            )}
          </dl>
        </div>

        {/* Source Records Modal */}
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
                <h3 className="text-xl font-bold text-white">
                  Source Records ({viewSourceModalData.records.length})
                </h3>
                <button
                  onClick={() => setViewSourceModalData(null)}
                  className="text-white hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="overflow-y-auto p-6 space-y-6">
                {viewSourceModalData.records.map((record, idx) => (
                  <div
                    key={idx}
                    className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold inline-block mb-3">
                      Record #{idx + 1}: {viewSourceModalData.recordIds[idx]}
                    </div>

                    {record.error ? (
                      <div className="text-red-600 italic">{record.error}</div>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(record).map(([key, value]) => (
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
                    )}
                  </div>
                ))}
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
    </div>
  );
}
