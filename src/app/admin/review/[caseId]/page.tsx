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
          <div className="flex flex-wrap gap-3">
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
        </div>

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

        {/* Editable Sections */}
        <div className="space-y-6">
          {Object.keys(edits).map((section) => {
            if (!Array.isArray(edits[section])) return null;

            const filteredItems = filterItemsByConfidence(edits[section]);
            const displayItems = showOnlyLowConfidence ? filteredItems : edits[section];

            return (
              <div
                key={section}
                className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 ${getSectionColor(section)}`}
              >
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
                  <h2 className="text-xl font-bold text-white">
                    {getSectionTitle(section)} ({edits[section].length})
                    {showOnlyLowConfidence && filteredItems.length !== edits[section].length && (
                      <span className="ml-2 text-sm font-normal opacity-90">
                        - Showing {filteredItems.length} low confidence items
                      </span>
                    )}
                  </h2>
                </div>

                <div className="p-6 space-y-4">
                  {displayItems.length === 0 && showOnlyLowConfidence ? (
                    <div className="text-center py-8 text-gray-500">
                      No low confidence items in this section
                    </div>
                  ) : (
                    displayItems.map((item: string, displayIndex: number) => {
                      const actualIndex = edits[section].indexOf(item);
                      const { text, confidence } = extractConfidenceFromText(item);

                      return (
                        <div key={actualIndex} className="flex gap-2">
                          <div className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-medium text-sm">
                            {actualIndex + 1}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start gap-2">
                              <textarea
                                value={item}
                                onChange={(e) => updateListItem(section, actualIndex, e.target.value)}
                                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-[80px] font-mono text-sm"
                              />
                              {getConfidenceBadge(confidence)}
                            </div>
                            {case_.analysis && (case_.analysis as any).forensic_audit_lineage && (
                              <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                                <span className="font-semibold">Source records: </span>
                                {(case_.analysis as any).forensic_audit_lineage[actualIndex]?.join(', ') || 'N/A'}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => removeListItem(section, actualIndex)}
                            className="flex-shrink-0 w-8 h-8 bg-red-100 hover:bg-red-200 text-red-700 rounded-full flex items-center justify-center transition-colors"
                            title="Remove item"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })
                  )}

                  <button
                    onClick={() => addListItem(section)}
                    className="w-full py-3 border-2 border-dashed border-gray-300 hover:border-purple-400 text-gray-600 hover:text-purple-600 rounded-lg transition-colors font-medium"
                  >
                    + Add {getSectionTitle(section)} Item
                  </button>
                </div>
              </div>
            );
          })}
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
      </div>
    </div>
  );
}
