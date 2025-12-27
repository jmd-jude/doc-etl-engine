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
- **Entry Point**: `backend/main.py` - FastAPI server on port 8000
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
6. Admin can edit → `src/app/admin/review/[caseId]/page.tsx`
7. Export to PDF → `pdf_generator.py`

## Development Commands

### Frontend (Next.js)
```bash
# Install dependencies
npm install

# Development server (http://localhost:3000)
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

# Run backend server (http://localhost:8000)
cd backend
python main.py
# or with uvicorn directly:
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Deactivate virtual environment
deactivate
```

### Running Both Services
The application requires both servers running simultaneously:
- Frontend: `npm run dev` (port 3000)
- Backend: `python backend/main.py` (port 8000)

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
- `GET /admin/case/{case_id}` - Get case details
- `POST /admin/update-edits` - Save edited analysis
- `POST /admin/update-status` - Update case status
- `GET /admin/export-pdf/{case_id}` - Export case to PDF

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

**Testing backend endpoints**: Use curl or browser:
```bash
curl http://localhost:8000/
curl http://localhost:8000/pipelines
curl -X POST http://localhost:8000/process -H "Content-Type: application/json" -d '{"records": [...], "pipeline": "psych_timeline"}'
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

Download sample JSON from the upload page.
