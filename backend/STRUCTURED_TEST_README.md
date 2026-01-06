# Structured Object Test for DocETL

## Purpose
Validate that DocETL can return structured JSON objects instead of pipe-delimited strings before committing to the enhanced UI architecture.

## Why This Matters
The enhanced UI (`/admin/review/[caseId]/enhanced/page.tsx`) requires structured data like:
```json
{
  "contradictions": [
    {
      "description": "Patient states never had depression vs history of recurrent depression",
      "records": ["MRN-2024-001", "MRN-2024-002"],
      "category": "symptoms",
      "severity": "critical",
      "legal_relevance": "high"
    }
  ]
}
```

Instead of the current pipe-delimited strings:
```json
{
  "contradictions": [
    "Records MRN-2024-001 and MRN-2024-002: Patient states never had depression... | Legal Relevance: high"
  ]
}
```

## Test Files Created

1. **test_structured_pipeline.py** - Documentation of the test approach
2. **test_sample_records.json** - 3 sample psychiatric records with intentional contradictions
3. **run_structured_test.sh** - Automated test runner script
4. **STRUCTURED_TEST_README.md** - This file

## Step-by-Step Test Process

### Step 1: Add Test Pipeline Configuration

Add this to `PIPELINE_CONFIGS` in `backend/pipeline_configs.py`:

```python
"test_structured": {
    "name": "Test: Structured Objects",
    "dataset_description": "medical and psychiatric records for testing structured output",
    "persona": "a forensic psychiatrist preparing expert witness testimony",
    "extraction_model": "gpt-4o-mini",
    "analysis_model": "gpt-4o-mini",

    "extraction_prompt": """Extract from this record:

Record: {{ input }}

Return JSON with:
- date: Record date
- record_id: Record ID
- provider: Provider name
- diagnoses: Psychiatric diagnoses
- medications: Medications and doses
- patient_statements: Relevant patient statements or behaviors
""",

    "analysis_prompt": """Prepare expert witness analysis:

{% for record in inputs %}
{{ record.date }} - {{ record.record_id }}:
Provider: {{ record.provider }}
Diagnoses: {{ record.diagnoses }}
Meds: {{ record.medications }}
Patient Statements: {{ record.patient_statements }}
---
{% endfor %}

Return JSON with:
- contradictions: List of contradiction objects, each with these exact fields:
  * description (string): Clear description of the contradiction
  * records (list of strings): Record IDs involved (e.g. ["MRN-2024-001", "MRN-2024-002"])
  * category (string): One of: diagnosis, medication, timeline, symptoms, treatment, other
  * severity (string): One of: critical, moderate, minor
  * legal_relevance (string): One of: high, medium, low

  Example:
  {
    "description": "Patient states never had depression vs history of recurrent depression",
    "records": ["MRN-2024-001", "MRN-2024-002"],
    "category": "symptoms",
    "severity": "critical",
    "legal_relevance": "high"
  }

- timeline: Chronological psychiatric timeline (simple string list)
""",

    "output_schema": {
        "date": "string",
        "record_id": "string",
        "provider": "string",
        "diagnoses": "list[str]",
        "medications": "list[str]",
        "patient_statements": "string"
    },

    "analysis_schema": {
        "contradictions": "list[dict]",  # ← Key change: was list[str]
        "timeline": "list[str]"
    }
},
```

### Step 2: Restart Backend

```bash
cd backend
source venv/bin/activate
python main.py
```

### Step 3: Run Test

**Option A: Automated Script**
```bash
cd backend
./run_structured_test.sh
```

**Option B: Manual API Call**
```bash
cd backend
curl -X POST http://localhost:8001/process \
  -H "Content-Type: application/json" \
  -d @test_sample_records.json \
  -F "pipeline=test_structured" \
  -F "customer_name=Test User" \
  -F "customer_email=test@example.com"
```

**Option C: Via Frontend**
1. Go to http://localhost:3001
2. Select "Test: Structured Objects" pipeline
3. Upload `test_sample_records.json`
4. Submit

### Step 4: Check Results

View the analysis results:
```bash
# Get case ID from response, then:
curl http://localhost:8001/admin/case/{CASE_ID} | python3 -m json.tool

# Or check the file directly:
cat /tmp/cases/{CASE_ID}.json | python3 -m json.tool
```

### Step 5: Verify Structure

**✓ SUCCESS - You should see:**
```json
{
  "analysis": {
    "contradictions": [
      {
        "description": "Patient states 'never had depression before' in MRN-2024-001 vs 'depression on and off for years' in MRN-2024-002",
        "records": ["MRN-2024-001", "MRN-2024-002"],
        "category": "symptoms",
        "severity": "critical",
        "legal_relevance": "high"
      }
    ],
    "timeline": [
      "2024-01-15: Initial psychiatric evaluation...",
      "2024-02-10: Follow-up visit...",
      "2024-03-05: Medication management..."
    ]
  }
}
```

**✗ FAILURE - If you see pipe-delimited strings:**
```json
{
  "analysis": {
    "contradictions": [
      "Records MRN-2024-001 and MRN-2024-002: Patient states... | Legal Relevance: high"
    ]
  }
}
```

This means DocETL didn't honor the `list[dict]` schema - investigate why.

## What This Test Proves

If successful, this confirms that:
- ✓ DocETL can return structured objects (not just strings)
- ✓ The schema `"contradictions": "list[dict]"` works correctly
- ✓ The LLM can be prompted to return proper JSON object structure
- ✓ The enhanced UI architecture is feasible

## Next Steps After Successful Test

1. **Modify all relevant fields** in production pipelines:
   - `contradictions`: list[dict] with {description, records, category, severity, legal_relevance}
   - `red_flags`: list[dict] with {category, issue, records, legal_relevance}
   - `standard_of_care_deviations`: list[dict] with similar structure
   - Others as needed

2. **Update analysis prompts** to return structured objects with clear instructions

3. **Build enhanced UI** that consumes clean JSON without string parsing

4. **Apply professional color scheme** suitable for MD audience

5. **Add back editing/comments/comparison** features from current review page

## Cleanup After Test

Remove the test configuration from `pipeline_configs.py`:
```python
# Delete the "test_structured" entry from PIPELINE_CONFIGS
```

## Sample Data Contradictions

The test data includes these intentional contradictions:

1. **Symptom History Contradiction**
   - MRN-2024-001: "I've never had depression before, this is new for me"
   - MRN-2024-002: "I've had depression on and off for years"

2. **Diagnosis Severity Change**
   - MRN-2024-001: "Major Depressive Disorder, Moderate"
   - MRN-2024-002: "Major Depressive Disorder, Recurrent, Severe"

3. **Medication Changes**
   - Sertraline 50mg → 100mg → switched to Fluoxetine
   - Lacks clear documentation of rationale

If DocETL successfully identifies these as structured contradiction objects, the test passes!
