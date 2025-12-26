# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InsightStream Forensic is a legal-grade forensic data discovery system that analyzes documents (medical records, legal depositions, insurance claims) to detect contradictions, identify gaps, and generate chronologies. It combines a Next.js frontend with a FastAPI backend powered by DocETL for LLM-based document analysis.

## Architecture

### Frontend (Next.js 16 + React 19)
- **Tech Stack**: Next.js App Router, TypeScript, Tailwind CSS 4
- **Entry Point**: `src/app/page.tsx` - Customer-facing upload interface
- **Admin Dashboard**: `src/app/admin/page.tsx` - Case management dashboard
- **Case Review**: `src/app/admin/review/[caseId]/page.tsx` - Individual case review with editing

### Backend (Python FastAPI)
- **Entry Point**: `backend/main.py` - FastAPI server on port 8000
- **Core Engine**: `backend/engine.py` - DocETL pipeline orchestration
- **Domain System**: `backend/domain_configs.py` - Multi-domain configuration (medical, legal, insurance)
- **Case Management**: `backend/case_manager.py` - Persistence in `/tmp/cases/*.json`
- **PDF Export**: `backend/pdf_generator.py` - Report generation

**Key Architecture Pattern**: Domain-based configuration system allows adding new document analysis domains (medical, legal_deposition, insurance_claim) by modifying only `domain_configs.py`. Each domain defines:
- Extraction prompts (map operation over individual records)
- Analysis prompts (reduce operation for forensic audit)
- Output schemas (structured JSON responses)

### Data Flow
1. User uploads JSON records → Frontend (`src/app/page.tsx`)
2. Frontend POSTs to `/process` → `backend/main.py`
3. Backend creates case → `case_manager.py`
4. DocETL pipeline runs → `engine.py` + `domain_configs.py`
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
- `GET /domains` - List available analysis domains
- `POST /process` - Upload and analyze documents
- `POST /export-pdf` - Export analysis to PDF

### Admin Endpoints
- `GET /admin/cases` - List all cases
- `GET /admin/case/{case_id}` - Get case details
- `POST /admin/update-edits` - Save edited analysis
- `POST /admin/update-status` - Update case status
- `GET /admin/export-pdf/{case_id}` - Export case to PDF

## Adding New Analysis Domains

To add a new domain (e.g., "contract_review"):

1. Add configuration to `DOMAIN_CONFIGS` in `backend/domain_configs.py`:
```python
"contract_review": {
    "name": "Contract Review",
    "dataset_description": "legal contracts and agreements",
    "persona": "a contract attorney with expertise in commercial agreements",
    "extraction_prompt": "...",  # Extract key terms
    "analysis_prompt": "...",     # Identify risks/gaps
    "output_schema": {...},
    "analysis_schema": {...}
}
```

2. Frontend automatically supports new domains via `/domains` endpoint

## Important Notes

- **CORS Configuration**: Backend allows `localhost:3000` and `localhost:3001`
- **Case Storage**: Cases persist in `/tmp/cases/` (temporary storage, consider moving to database for production)
- **LLM Model**: Default model is `gpt-4o-mini` (configured in `engine.py`)
- **Python Version**: Uses Python 3.13 (check `backend/venv/pyvenv.cfg`)
- **Font System**: Uses Geist Sans and Geist Mono fonts via `next/font`

## Common Development Tasks

**Adding a new frontend page**: Create file in `src/app/{route}/page.tsx`

**Modifying analysis logic**: Edit prompts in `backend/domain_configs.py`

**Changing case persistence**: Modify `backend/case_manager.py`

**Updating UI styling**: Edit Tailwind classes in component files

**Testing backend endpoint**: Use curl or browser:
```bash
curl http://localhost:8000/
curl http://localhost:8000/domains
```
