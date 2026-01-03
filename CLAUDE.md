# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InsightStream Forensic is a legal-grade forensic psychiatry analysis system that analyzes psychiatric records to detect contradictions, identify treatment gaps, evaluate compliance, and generate comprehensive timelines. It combines a Next.js frontend with a FastAPI backend powered by DocETL for LLM-based document analysis.

**Focus**: Forensic psychiatry with 4 service tiers ranging from basic timeline construction to comprehensive expert witness packages.

## Architecture

### Frontend (Next.js 16 + React 19)
- **Tech Stack**: Next.js App Router, TypeScript, Tailwind CSS 4
- **Entry Point**: `src/app/page.tsx` - Customer-facing upload interface with pipeline selector
- **Admin Dashboard**: `src/app/admin/page.tsx` - Case management dashboard
- **Case Review**: `src/app/admin/review/[caseId]/page.tsx` - Individual case review with editing

### Backend (Python FastAPI)
- **Entry Point**: `backend/main.py` - FastAPI server on port 8001
- **Core Engine**: `backend/engine.py` - DocETL pipeline orchestration
- **Pipeline System**: `backend/pipeline_configs.py` - Multi-tier forensic psychiatry pipelines
- **Case Management**: `backend/case_manager.py` - Persistence in `/tmp/cases/*.json`
- **PDF Export**: `backend/pdf_generator.py` - Report generation

**Key Architecture Pattern**: Pipeline-based configuration system allows scaling analysis depth within forensic psychiatry domain. Each pipeline defines:
- Extraction prompts (map operation over individual psychiatric records)
- Analysis prompts (reduce operation for forensic audit)
- Output schemas (structured JSON responses)
- Analysis schemas (defines output fields like timeline, treatment_gaps, medication_adherence, etc.)

**Available Pipelines** (increasing depth):
1. `psych_timeline` - Basic Timeline (2 fields: timeline, treatment_gaps)
2. `psych_compliance` - Compliance Audit (5 fields: adds medication_adherence, safety_documentation, consent_issues)
3. `psych_expert_witness` - Expert Witness Package (7 fields: adds contradictions, standard_of_care_deviations, competency_timeline, expert_opinions_needed)
4. `psych_full_discovery` - Full Discovery Analysis (13 fields: adds functional_capacity_timeline, suicide_violence_risk_assessment, substance_use_impact, legal_psychiatric_interface, causation_analysis, damages_assessment)

### Data Flow
1. User selects pipeline tier and uploads JSON records → Frontend (`src/app/page.tsx`)
2. Frontend POSTs to `/process` with `pipeline` parameter → `backend/main.py`
3. Backend creates case → `case_manager.py`
4. DocETL pipeline runs → `engine.py` + `pipeline_configs.py`
5. Analysis results stored → `/tmp/cases/{case_id}.json`
   - Original AI analysis saved in `analysis` field
   - Deep copy created in `edits` field (allows modification without affecting original)
   - Original source records stored in `original_records` field (for provenance)
6. Admin reviews case → `src/app/admin/review/[caseId]/page.tsx`
   - Edit findings inline
   - Add expert comments to document reasoning
   - View source records for provenance
   - See AI vs Expert comparison (side-by-side mode)
7. Export to PDF with track changes → `pdf_generator.py`
   - Shows which findings were AI-generated, edited, or added by expert
   - Includes expert comments inline

## Development Commands

### Frontend (Next.js)
```bash
# Install dependencies
npm install

# Development server (http://localhost:3001)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint
npm run lint
```

### Backend (Python FastAPI)
```bash
# Activate virtual environment
source backend/venv/bin/activate

# Install dependencies (if requirements.txt exists)
pip install -r backend/requirements.txt

# Or manually install core dependencies
pip install fastapi uvicorn docetl python-dotenv

# Run backend server (http://localhost:8001)
cd backend
python main.py
# or with uvicorn directly:
uvicorn main:app --host 0.0.0.0 --port 8001 --reload

# Deactivate virtual environment
deactivate
```

### Running Both Services
The application requires both servers running simultaneously:
- Frontend: `npm run dev` (port 3001)
- Backend: `python backend/main.py` (port 8001)

## Key Configuration Files

- `package.json` - Node dependencies and scripts
- `tsconfig.json` - TypeScript config with `@/*` path alias to `./src/*`
- `next.config.ts` - Next.js configuration
- `tailwind.config.ts` (if exists) - Tailwind CSS configuration
- `backend/venv/` - Python 3.13 virtual environment (do not modify)
- `.env` (if exists) - Environment variables for OpenAI API keys (used by DocETL)

## API Endpoints

### Public Endpoints
- `GET /` - Health check
- `GET /pipelines` - List available analysis pipelines
- `GET /domains` - (Deprecated) Legacy endpoint, use `/pipelines`
- `POST /process` - Upload and analyze documents (accepts `pipeline` parameter)
- `POST /export-pdf` - Export analysis to PDF

### Admin Endpoints
- `GET /admin/cases` - List all cases
- `GET /admin/case/{case_id}` - Get case details (includes analysis, edits, comments, original_records)
- `POST /admin/update-edits` - Save edited analysis and expert comments
  - Accepts: `{ case_id, edits, comments }`
- `POST /admin/update-status` - Update case status
- `GET /admin/export-pdf/{case_id}` - Export case to PDF with track changes

## Human-in-the-Loop Features

### Expert Review Interface (`src/app/admin/review/[caseId]/page.tsx`)

**View Modes:**
- **AI Original** - Read-only view of pristine AI-generated analysis
- **Expert Version** - Editable view for expert modifications (default)
- **Side-by-Side** - Two-column comparison showing AI vs Expert changes
  - Visual indicators: Green (added), Blue (edited), Unchanged (white)

**Edit Metrics Dashboard:**
- Automatically calculates and displays:
  - Total AI-generated findings
  - Findings validated unchanged (%)
  - Findings edited by expert (%)
  - Findings removed by expert (%)
  - Findings added by expert
  - Expert Enhancement Rate (% modified)

**Expert Comments & Annotations:**
- Click 💬 button next to any finding to add expert rationale
- Comments stored separately in `comments` field: `{ [section]: { [index]: "comment text" } }`
- Comments display inline below findings
- Saved with case data for legal defensibility

**Source Record Provenance:**
- "View All Source Records" button shows original JSON documents
- Modal displays all source data with dynamic rendering (works with any JSON structure)
- Enables experts to verify AI findings against source material

**Data Structure in Case JSON:**
```json
{
  "analysis": { /* Original AI output */ },
  "edits": { /* Expert-modified version */ },
  "comments": {
    "timeline": {
      "0": "Changed severity based on PHQ-9 score of 22 in record PSY-2024-003",
      "3": "Added per expert clinical judgment - not explicitly stated in records"
    }
  },
  "original_records": [ /* Full source documents for provenance */ ]
}
```

### PDF Export with Track Changes (`backend/pdf_generator.py`)

**Visual Indicators in Exported PDF:**
- ✓ = AI-Generated, validated by expert (black text)
- ✏ = Edited by expert (blue text)
- ✚ = Added by expert (green text)
- 💬 = Expert comment/rationale (purple italic)

**Track Changes Legend:**
Automatically included at top of PDF when original analysis is available.

**Implementation:**
- Compares `analysis` (original) vs `edits` (modified) to detect changes
- Renders appropriate icon and style based on change status
- Includes expert comments inline under relevant findings

**Example PDF Output:**
```
TIMELINE
✓ 1. 2024-01-15: Initial evaluation showing moderate depression
✏ 2. 2024-02-10: Follow-up evaluation showing severe depression symptoms
    💬 Expert Note: Severity upgraded per PHQ-9 score of 22 in PSY-2024-003
✚ 3. 2024-03-01: Medication adjustment not documented in treatment notes
    💬 Expert Note: Gap identified through cross-referencing prescription records
```

## Adding New Analysis Pipelines

To add a new pipeline tier (e.g., "psych_brief_screen"):

1. Add configuration to `PIPELINE_CONFIGS` in `backend/pipeline_configs.py`:
```python
"psych_brief_screen": {
    "name": "Brief Screening",
    "dataset_description": "psychiatric evaluation records",
    "persona": "a forensic psychiatrist conducting initial screening",
    "extraction_prompt": """Extract from this record:

    Record: {{ input }}

    Return JSON with:
    - date: Record date (YYYY-MM-DD)
    - diagnoses: List of diagnoses mentioned
    - risk_level: (low, moderate, high)
    """,
    "analysis_prompt": """Create screening summary:

    {% for record in inputs %}
    {{ record.date }}: Diagnoses: {{ record.diagnoses }}, Risk: {{ record.risk_level }}
    {% endfor %}

    Return JSON with:
    - screening_summary: Overall assessment
    - high_risk_flags: Any high-risk indicators found
    """,
    "output_schema": {
        "date": "string",
        "diagnoses": "list[str]",
        "risk_level": "string"
    },
    "analysis_schema": {
        "screening_summary": "list[str]",
        "high_risk_flags": "list[str]"
    }
}
```

2. Frontend automatically supports new pipelines via `/pipelines` endpoint
3. Update section mappings in `src/app/admin/review/[caseId]/page.tsx` if adding new analysis schema fields

## Important Notes

- **CORS Configuration**: Backend allows `localhost:3000` and `localhost:3001`
- **Case Storage**: Cases persist in `/tmp/cases/` on macOS/Linux (access via `Cmd+Shift+G` → `/tmp/cases/` in Finder)
  - To move to project: Change `CASES_DIR` in `backend/case_manager.py` to use project directory
- **LLM Model**: Default model is `gpt-4o-mini` (configured in `engine.py`)
- **Python Version**: Uses Python 3.13 (check `backend/venv/pyvenv.cfg`)
- **Font System**: Uses Geist Sans and Geist Mono fonts via `next/font`
- **Dynamic UI**: Frontend automatically renders any analysis fields returned by pipelines
- **Backward Compatibility**: Supports both legacy `domain` and new `pipeline` fields in case data

## Common Development Tasks

**Adding a new frontend page**: Create file in `src/app/{route}/page.tsx`

**Modifying analysis logic**: Edit prompts in `backend/pipeline_configs.py`

**Adding a new pipeline tier**: Add to `PIPELINE_CONFIGS` in `backend/pipeline_configs.py` (see "Adding New Analysis Pipelines" section)

**Changing case persistence**: Modify `backend/case_manager.py`

**Updating UI styling**: Edit Tailwind classes in component files

**Adding new analysis fields**: Add to `analysis_schema` in pipeline config; frontend displays automatically

**Adding new comment types or metadata**: Extend the `comments` structure in `Case` interface and `update_case_edits()` function

**Customizing PDF track changes**: Modify styles and rendering logic in `pdf_generator.py`
- Change icons: Edit `get_icon_and_style()` function
- Modify colors: Update ParagraphStyle definitions (edited_style, added_style, etc.)
- Add new indicators: Extend `get_change_status()` logic

**Adding expert workflow features**:
- New view modes: Add to `viewMode` state and conditional rendering in review page
- Additional metrics: Extend `calculateEditMetrics()` function
- Custom filters: Add to filtering logic (similar to `showOnlyLowConfidence`)

**Testing backend endpoints**: Use curl or browser:
```bash
curl http://localhost:8001/
curl http://localhost:8001/pipelines
curl -X POST http://localhost:8001/process -H "Content-Type: application/json" -d '{"records": [...], "pipeline": "psych_timeline"}'

# Test with comments
curl -X POST http://localhost:8001/admin/update-edits \
  -H "Content-Type: application/json" \
  -d '{"case_id": "20260103_103552", "edits": {...}, "comments": {"timeline": {"0": "Expert note"}}}'
```

## Sample Data Format

Psychiatric records should be JSON arrays with fields like:
```json
[
  {
    "date": "2024-01-15",
    "record_id": "PSY-2024-001",
    "provider": "Dr. Jane Smith, MD",
    "record_type": "Initial Psychiatric Evaluation",
    "diagnoses": ["Major Depressive Disorder, Recurrent, Severe"],
    "medications": ["Sertraline 100mg daily"],
    "chief_complaint": "Patient reports worsening depression...",
    "mental_status": "Alert and oriented x3. Depressed affect.",
    "treatment_plan": "Continue current medications. Weekly therapy.",
    "safety_assessment": "Low acute risk. No current suicidal ideation."
  }
]
```
