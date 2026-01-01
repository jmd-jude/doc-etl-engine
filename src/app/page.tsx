'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, CheckCircle2, AlertCircle, FileJson, Download, AlertTriangle, XCircle, Clock } from 'lucide-react';

type ProcessingState = 'ready' | 'processing' | 'complete' | 'error';

interface AnalysisResult {
  [key: string]: string[];
}

const PROCESSING_STAGES = [
  'Validating inputs structure...',
  'Extracting data from records...',
  'Running entity resolution...',
  'Auditing...',
  'Identifying gaps...',
  'Synthesizing...',
];

const SAMPLE_JSON = [
  {
    "date": "2024-01-15",
    "record_id": "PSY-2024-001",
    "provider": "Dr. Jane Smith, MD",
    "record_type": "Initial Psychiatric Evaluation",
    "diagnoses": ["Major Depressive Disorder, Recurrent, Severe", "Generalized Anxiety Disorder"],
    "medications": ["Sertraline 100mg daily", "Lorazepam 0.5mg PRN"],
    "chief_complaint": "Patient reports worsening depression and anxiety symptoms over past 3 months",
    "mental_status": "Alert and oriented x3. Depressed affect. Denies SI/HI.",
    "treatment_plan": "Continue current medications. Weekly therapy. Follow-up in 2 weeks.",
    "safety_assessment": "Low acute risk. No current suicidal ideation. Patient has safety plan."
  },
  {
    "date": "2024-01-29",
    "record_id": "PSY-2024-002",
    "provider": "Dr. Jane Smith, MD",
    "record_type": "Follow-up Visit",
    "diagnoses": ["Major Depressive Disorder, Recurrent, Severe"],
    "medications": ["Sertraline 150mg daily (increased)", "Lorazepam 0.5mg PRN"],
    "chief_complaint": "No improvement in symptoms despite compliance with treatment",
    "mental_status": "Tearful during session. Reports increased hopelessness.",
    "treatment_plan": "Increase Sertraline to 150mg. Consider adjunct therapy if no improvement.",
    "safety_assessment": "Moderate risk. Passive suicidal ideation without plan or intent."
  },
  {
    "date": "2024-02-15",
    "record_id": "PSY-2024-003",
    "provider": "Dr. Jane Smith, MD",
    "record_type": "Crisis Evaluation",
    "diagnoses": ["Major Depressive Disorder, Recurrent, Severe with Psychotic Features"],
    "medications": ["Sertraline 150mg daily", "Risperidone 2mg daily (added)", "Lorazepam 0.5mg PRN"],
    "chief_complaint": "Family brought patient in due to increasing isolation and auditory hallucinations",
    "mental_status": "Disheveled appearance. Flat affect. Responds to internal stimuli. Reports voices telling them they're worthless.",
    "treatment_plan": "Start Risperidone. Daily check-ins. Consider partial hospitalization program.",
    "safety_assessment": "High risk. Active suicidal ideation with plan. Contract for safety signed. Emergency contact provided."
  }
];

export default function ForensicDiscovery() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [state, setState] = useState<ProcessingState>('ready');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [recordCount, setRecordCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [caseId, setCaseId] = useState<string | null>(null);
  const [availablePipelines, setAvailablePipelines] = useState<Array<{id: string; name: string}>>([]);
  const [selectedPipeline, setSelectedPipeline] = useState('psych_timeline');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useHybridMode, setUseHybridMode] = useState(false);

  // Fetch available pipelines on mount
  useEffect(() => {
    const fetchPipelines = async () => {
      try {
        const response = await fetch('http://localhost:8001/pipelines');
        const data = await response.json();
        if (data.pipelines && data.pipelines.length > 0) {
          setAvailablePipelines(data.pipelines);
          setSelectedPipeline(data.pipelines[0].id);
        }
      } catch (err) {
        console.error('Failed to load pipelines:', err);
      }
    };
    fetchPipelines();
  }, []);

  // Check backend status on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('http://localhost:8001/', {
          signal: AbortSignal.timeout(5000), // Increased to 5 seconds
          mode: 'cors'
        });
        if (response.ok) {
          setBackendStatus('online');
        } else {
          console.error('Backend returned non-OK status:', response.status);
          setBackendStatus('offline');
        }
      } catch (error) {
        // Silently handle timeout errors during processing - backend is likely busy
        if (error instanceof Error && error.name === 'TimeoutError') {
          // Don't change status during timeout - backend is probably processing
          return;
        }
        console.error('Backend health check failed:', error);
        setBackendStatus('offline');
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, []);

  // Simulate processing stages
  useEffect(() => {
    if (state === 'processing') {
      const stageInterval = setInterval(() => {
        setCurrentStage((prev) => {
          if (prev < PROCESSING_STAGES.length - 1) {
            setProgress(((prev + 1) / PROCESSING_STAGES.length) * 100);
            return prev + 1;
          }
          return prev;
        });
      }, 1200);
      return () => clearInterval(stageInterval);
    }
  }, [state]);

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.json')) {
      setError('Please select a JSON file');
      return;
    }
    setSelectedFile(file);
    setError(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setState('processing');
    setProgress(0);
    setCurrentStage(0);
    setError(null);

    try {
      const text = await selectedFile.text();
      const data = JSON.parse(text);
      const recordsArray = Array.isArray(data) ? data : [data];
      setRecordCount(recordsArray.length);

      // Wait for processing animation to complete
      await new Promise(resolve => setTimeout(resolve, PROCESSING_STAGES.length * 1200));

      const response = await fetch('http://localhost:8001/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: recordsArray,
          pipeline: selectedPipeline,
          customer_name: customerName || 'Confidential Client',
          customer_email: customerEmail || '',
          hybrid_mode: useHybridMode
        }),
        signal: AbortSignal.timeout(120000), // 2 minute timeout for processing
      });

      if (!response.ok) throw new Error('Processing failed');

      const result = await response.json();

      // Store case ID for linking to admin
      if (result.case_id) {
        setCaseId(result.case_id);
      }

      if (result.status === 'error') {
        throw new Error(result.error);
      }

      setAnalysis(result.analysis);
      setState('complete');
      setProgress(100);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'An error occurred during processing');
    }
  };

  const downloadSample = () => {
    const blob = new Blob([JSON.stringify(SAMPLE_JSON, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-forensic-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-[var(--font-geist-sans)]">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-emerald-500 rounded-full"></div>
            <h1 className="text-xl font-semibold tracking-tight">FPA Med - ChronoScope - Medical Chronology AI</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">System Status</span>
            <div className="relative">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  backendStatus === 'online'
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                    : backendStatus === 'offline'
                    ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                    : 'bg-slate-600'
                }`}
              ></div>
              {backendStatus === 'online' && (
                <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
              )}
            </div>
            <span className="text-xs text-slate-500 font-[var(--font-geist-mono)]">
              {backendStatus === 'checking' ? 'Checking...' : backendStatus === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Intake Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Data Intake</h2>
              <p className="text-slate-400 text-sm">
                Upload case files (JSON)
              </p>
            </div>
            <div className="flex gap-3">
              {/* <button
                onClick={downloadSample}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:bg-slate-800 transition-colors text-sm"
              >
                <Download className="h-4 w-4" />
                Sample Data
              </button>*/}
              <a
                href="/admin"
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors text-sm font-medium"
              >
                Admin Dashboard →
              </a>
            </div>
          </div>

          {/* Analysis Package Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Select Package
            </label>
            <select
              value={selectedPipeline}
              onChange={(e) => setSelectedPipeline(e.target.value)}
              disabled={state === 'processing'}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {availablePipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          </div>

          {/* Advanced Options */}
          <div className="mb-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-purple-300 hover:text-white transition-colors flex items-center gap-2"
              disabled={state === 'processing'}
            >
              <span>{showAdvanced ? '▼' : '▶'}</span>
              Advanced Options
            </button>

            {showAdvanced && (
              <div className="mt-4 p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                <label className="flex items-start gap-3 text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useHybridMode}
                    onChange={(e) => setUseHybridMode(e.target.checked)}
                    disabled={state === 'processing'}
                    className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-700 text-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div>
                    <div className="font-medium">Use Hybrid Mode (Premium)</div>
                    <div className="text-sm text-slate-400 mt-1">
                      Uses Claude Sonnet 4 for analysis (higher quality) and GPT-4o-mini for extraction.
                    </div>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Customer Information */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Customer Name <span className="text-slate-500">(Optional)</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="John Smith, Esq."
                disabled={state === 'processing'}
                className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Customer Email <span className="text-slate-500">(Optional)</span>
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="john@smithlaw.com"
                disabled={state === 'processing'}
                className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-12 transition-all ${
              isDragging
                ? 'border-emerald-500 bg-emerald-500/5'
                : state === 'ready' || state === 'complete'
                ? 'border-slate-700/50 hover:border-slate-600'
                : 'border-slate-800/50'
            } ${state === 'processing' ? 'pointer-events-none' : ''}`}
          >
            <div className="flex flex-col items-center gap-4">
              {state === 'ready' && (
                <>
                  <FileJson className="h-12 w-12 text-slate-600" />
                  <div className="text-center">
                    <p className="text-lg mb-1">Drop your case file here</p>
                    <p className="text-sm text-slate-500">or click to browse</p>
                  </div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    className="hidden"
                    id="file-input"
                  />
                  <label
                    htmlFor="file-input"
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer transition-colors font-medium text-sm"
                  >
                    Select File
                  </label>
                  {selectedFile && (
                    <div className="mt-4 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                      <p className="text-sm font-[var(--font-geist-mono)] text-emerald-400">
                        {selectedFile.name}
                      </p>
                    </div>
                  )}
                </>
              )}

              {state === 'processing' && (
                <div className="w-full max-w-md">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
                    <div>
                      <p className="font-medium">Analyzing {recordCount} records</p>
                      <p className="text-sm text-slate-400 font-[var(--font-geist-mono)]">
                        {PROCESSING_STAGES[currentStage]}
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {state === 'complete' && (
                <div className="text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                  <p className="text-lg font-medium mb-1">Forensic Analysis Complete</p>
                  <p className="text-sm text-slate-400 mb-4">
                    {recordCount} record{recordCount !== 1 ? 's' : ''} analyzed
                  </p>
                  {caseId && (
                    <a
                      href={`/admin/review/${caseId}`}
                      className="inline-block px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium text-sm mb-3"
                    >
                      Review Case in Admin →
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setState('ready');
                      setSelectedFile(null);
                      setAnalysis(null);
                      setRecordCount(0);
                      setCaseId(null);
                    }}
                    className="mt-4 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors text-sm block mx-auto"
                  >
                    Analyze Another File
                  </button>
                </div>
              )}

              {state === 'error' && (
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                  <p className="text-lg font-medium mb-1">Analysis Failed</p>
                  <p className="text-sm text-amber-400">{error}</p>
                  <button
                    onClick={() => {
                      setState('ready');
                      setError(null);
                    }}
                    className="mt-4 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors text-sm"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>

          {selectedFile && state === 'ready' && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleUpload}
                disabled={backendStatus !== 'online'}
                className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
              >
                <Upload className="h-5 w-5" />
                Upload & Analyze
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Analysis Results */}
        {analysis && Object.keys(analysis).length > 0 && (
          <div className="space-y-8">
            <h2 className="text-2xl font-semibold mb-6">Analysis Results</h2>

            {Object.entries(analysis).map(([key, items]) => {
              if (!Array.isArray(items) || items.length === 0) return null;

              // Determine section styling based on key name
              const isHighAlert = key.includes('gap') || key.includes('deviation') || key.includes('issue') || key.includes('risk');
              const isWarning = key.includes('contradiction') || key.includes('inconsistenc');
              const isTimeline = key.includes('timeline') || key.includes('chronology');

              const borderColor = isHighAlert ? 'border-red-900/50' : isWarning ? 'border-amber-900/50' : isTimeline ? 'border-emerald-900/50' : 'border-slate-800/50';
              const bgColor = isHighAlert ? 'bg-red-950/20' : isWarning ? 'bg-amber-950/20' : isTimeline ? 'bg-emerald-950/20' : 'bg-slate-900/30';
              const headerBg = isHighAlert ? 'bg-red-950/30' : isWarning ? 'bg-amber-950/30' : isTimeline ? 'bg-emerald-950/30' : 'bg-slate-900/50';
              const iconColor = isHighAlert ? 'text-red-400' : isWarning ? 'text-amber-400' : isTimeline ? 'text-emerald-400' : 'text-slate-400';
              const textColor = isHighAlert ? 'text-red-200/90' : isWarning ? 'text-amber-200/90' : isTimeline ? 'text-emerald-200/90' : 'text-slate-200';
              const badgeBg = isHighAlert ? 'bg-red-500/10' : isWarning ? 'bg-amber-500/10' : isTimeline ? 'bg-emerald-500/10' : 'bg-slate-500/10';
              const badgeBorder = isHighAlert ? 'border-red-500/30' : isWarning ? 'border-amber-500/30' : isTimeline ? 'border-emerald-500/30' : 'border-slate-500/30';
              const badgeText = isHighAlert ? 'text-red-400' : isWarning ? 'text-amber-400' : isTimeline ? 'text-emerald-400' : 'text-slate-400';

              // Format section title
              const title = key
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

              const Icon = isHighAlert ? XCircle : isWarning ? AlertTriangle : isTimeline ? Clock : CheckCircle2;

              return (
                <div key={key} className={`border ${borderColor} rounded-lg ${bgColor} overflow-hidden`}>
                  <div className={`border-b ${borderColor} px-6 py-4 ${headerBg}`}>
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${iconColor}`} />
                      <h3 className={`font-semibold ${iconColor}`}>{title}</h3>
                    </div>
                    <p className={`text-sm ${iconColor}/80 mt-1`}>
                      {items.length} item{items.length !== 1 ? 's' : ''} identified
                    </p>
                  </div>
                  <div className="p-6 space-y-3">
                    {items.map((item, index) => (
                      <div key={index} className="flex gap-3">
                        <div className={`h-6 w-6 rounded-full ${badgeBg} border ${badgeBorder} flex items-center justify-center ${badgeText} text-xs font-medium flex-shrink-0 mt-0.5`}>
                          {index + 1}
                        </div>
                        <p className={`${textColor} text-sm leading-relaxed`}>{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!analysis && state === 'ready' && (
          <div className="border border-slate-800/50 rounded-lg bg-slate-900/30 overflow-hidden">
            <div className="text-center py-16">
              <FileJson className="h-16 w-16 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500 text-lg">No analysis yet</p>
              <p className="text-sm text-slate-600 mt-1">
                Upload Data (PDF or JSON)
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-sm text-slate-500">
          <p>FPA Med - ChronoScope - Medical Chronology AI</p>
          <p className="mt-1 font-[var(--font-geist-mono)] text-xs">
            Powered by DocETL • FPAMed
          </p>
        </div>
      </footer>
    </div>
  );
}
