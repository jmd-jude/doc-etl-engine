from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Any, Optional
import uvicorn
import os

app = FastAPI()

# VERY IMPORTANT: This allows your Next.js app to talk to Python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "Engine is purring"}

@app.get("/pipelines")
def list_pipelines_endpoint():
    """
    Get list of available analysis pipelines
    """
    from pipeline_configs import list_pipelines
    return {"pipelines": list_pipelines()}

class ProcessRequest(BaseModel):
    records: List[dict]
    pipeline: str = "psych_timeline"  # Default to basic timeline
    customer_name: Optional[str] = "Confidential Client"
    customer_email: Optional[str] = ""
    hybrid_mode: Optional[bool] = False  # Use Claude for analysis, GPT-4o-mini for extraction

class ExportPDFRequest(BaseModel):
    analysis: dict
    customer_name: Optional[str] = "Confidential Client"
    pipeline: str = "psych_timeline"
    records_analyzed: int = 0

class UpdateEditsRequest(BaseModel):
    case_id: str
    edits: dict
    comments: Optional[dict] = None

class UpdateStatusRequest(BaseModel):
    case_id: str
    status: str

class ChatRequest(BaseModel):
    case_id: str
    message: str
    history: List[dict] = []  # List of {role: str, content: str}

@app.post("/process")
async def process_data(request: ProcessRequest):
    """
    Universal Forensic Discovery Endpoint
    Receives documents and returns pipeline-specific forensic analysis

    Parameters:
    - records: List of document records (JSON objects)
    - pipeline: One of "psych_timeline" (default), "psych_compliance", "psych_expert_witness", "psych_full_discovery"
    - customer_name: Optional customer name for case tracking
    - customer_email: Optional customer email for case tracking
    """
    records = request.records
    pipeline = request.pipeline
    customer_name = request.customer_name
    customer_email = request.customer_email
    hybrid_mode = request.hybrid_mode

    print(f"\n{'='*60}")
    print(f"[API] Received {len(records)} records for {pipeline} analysis")
    if hybrid_mode:
        print(f"[API] Hybrid mode enabled: Claude Sonnet 4 for analysis")
    print(f"{'='*60}\n")

    # Import the pipeline
    try:
        from engine import run_forensic_pipeline
        from pipeline_configs import get_pipeline_config
        from case_manager import create_case, update_case_analysis
    except Exception as import_error:
        print(f"[API Error] Failed to import pipeline: {import_error}")
        return {
            "status": "error",
            "error": f"Pipeline import failed: {str(import_error)}",
            "analysis": {}
        }

    # Validate pipeline
    try:
        pipeline_config = get_pipeline_config(pipeline)
        print(f"[API] Using pipeline: {pipeline_config['name']}")
    except ValueError as e:
        return {
            "status": "error",
            "error": str(e),
            "analysis": {}
        }

    # Create case record
    case_id = create_case(customer_name, customer_email, pipeline, len(records))

    # Run the DocETL pipeline
    try:
        print("[API] Starting pipeline execution...")
        result = run_forensic_pipeline(records, pipeline=pipeline, hybrid_mode=hybrid_mode)
        print(f"[API] Pipeline returned: {result}")

        # Extract analysis and cost data from result
        if "cost_data" in result:
            analysis = result["analysis"]
            cost_data = result["cost_data"]
        else:
            # Backward compatibility: if no cost_data, treat entire result as analysis
            analysis = result
            cost_data = None

        # Log analysis metrics (keys depend on pipeline)
        print(f"\n[API] Analysis complete:")
        for key, value in analysis.items():
            if isinstance(value, list):
                print(f"  - {key}: {len(value)} items")
        print()

        # Update case with analysis results and original records (for provenance)
        update_case_analysis(case_id, analysis, original_records=records)

        # Update case with cost data if available
        if cost_data:
            from case_manager import update_case_costs
            update_case_costs(case_id, cost_data)

        return {
            "status": "success",
            "case_id": case_id,
            "pipeline": pipeline,
            "records_analyzed": len(records),
            "analysis": analysis
        }
    except Exception as e:
        print(f"[API Error] {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e),
            "analysis": {}
        }

@app.post("/export-pdf")
async def export_pdf(request: ExportPDFRequest):
    """
    Export forensic analysis to PDF

    Parameters:
    - analysis: Analysis results dict
    - customer_name: Name for PDF header
    - pipeline: Pipeline type (for title)
    - records_analyzed: Number of records processed
    """
    try:
        from pdf_generator import generate_forensic_pdf
        from pipeline_configs import get_pipeline_config

        # Get pipeline config for proper title
        try:
            pipeline_config = get_pipeline_config(request.pipeline)
            domain_name = pipeline_config['name']
        except:
            domain_name = "Forensic Analysis"

        # Prepare case info
        case_info = {
            "customer_name": request.customer_name,
            "domain_name": domain_name,
            "records_analyzed": request.records_analyzed
        }

        # Generate PDF
        output_path = "/tmp/forensic_report.pdf"
        generate_forensic_pdf(request.analysis, case_info, output_path)

        return FileResponse(
            output_path,
            media_type="application/pdf",
            filename=f"forensic_report_{request.customer_name.replace(' ', '_')}.pdf"
        )

    except Exception as e:
        print(f"[PDF Export Error] {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e)
        }

@app.get("/admin/cases")
async def list_all_cases():
    """
    Admin endpoint: List all cases

    Returns:
        List of all case records
    """
    try:
        from case_manager import list_cases
        cases = list_cases()
        return {
            "status": "success",
            "cases": cases
        }
    except Exception as e:
        print(f"[Admin Error] {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e)
        }

@app.get("/admin/case/{case_id}")
async def get_case_details(case_id: str):
    """
    Admin endpoint: Get case details

    Parameters:
        case_id: Case ID

    Returns:
        Full case record including analysis and edits
    """
    try:
        from case_manager import get_case
        case = get_case(case_id)
        if case is None:
            return {
                "status": "error",
                "error": f"Case {case_id} not found"
            }
        return {
            "status": "success",
            "case": case
        }
    except Exception as e:
        print(f"[Admin Error] {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e)
        }

@app.post("/admin/update-edits")
async def update_edits(request: UpdateEditsRequest):
    """
    Admin endpoint: Update case edits and comments

    Parameters:
        case_id: Case ID
        edits: Edited analysis dict
        comments: Expert comments dict (optional)

    Returns:
        Success status
    """
    try:
        from case_manager import update_case_edits
        update_case_edits(request.case_id, request.edits, request.comments)
        return {
            "status": "success",
            "message": f"Edits saved for case {request.case_id}"
        }
    except Exception as e:
        print(f"[Admin Error] {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e)
        }

@app.post("/admin/update-status")
async def update_status(request: UpdateStatusRequest):
    """
    Admin endpoint: Update case status

    Parameters:
        case_id: Case ID
        status: New status (pending_review, approved, delivered)

    Returns:
        Success status
    """
    try:
        from case_manager import update_case_status
        update_case_status(request.case_id, request.status)
        return {
            "status": "success",
            "message": f"Case {request.case_id} marked as {request.status}"
        }
    except Exception as e:
        print(f"[Admin Error] {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e)
        }

@app.get("/admin/export-pdf/{case_id}")
async def export_case_pdf(case_id: str):
    """
    Admin endpoint: Export PDF for a specific case (uses edited version)

    Parameters:
        case_id: Case ID

    Returns:
        PDF file
    """
    try:
        from pdf_generator import generate_forensic_pdf
        from case_manager import get_case
        from pipeline_configs import get_pipeline_config

        # Get case
        case = get_case(case_id)
        if case is None:
            return {
                "status": "error",
                "error": f"Case {case_id} not found"
            }

        # Get pipeline config for proper title (fallback to 'pipeline' field if 'domain' exists for backward compat)
        try:
            pipeline_id = case.get("pipeline", case.get("domain", "psych_timeline"))
            pipeline_config = get_pipeline_config(pipeline_id)
            domain_name = pipeline_config['name']
        except:
            domain_name = "Forensic Analysis"

        # Prepare case info
        case_info = {
            "customer_name": case.get("customer_name", "Confidential Client"),
            "domain_name": domain_name,
            "records_analyzed": case.get("records_count", 0)
        }

        # Get both original and edited versions for track changes
        original_analysis = case.get("analysis", {})
        edited_analysis = case.get("edits", original_analysis)
        comments = case.get("comments", {})

        # Generate PDF with track changes
        output_path = f"/tmp/forensic_report_{case_id}.pdf"
        generate_forensic_pdf(edited_analysis, case_info, output_path, original_analysis=original_analysis, comments=comments)

        return FileResponse(
            output_path,
            media_type="application/pdf",
            filename=f"forensic_report_{case['customer_name'].replace(' ', '_')}_{case_id}.pdf"
        )

    except Exception as e:
        print(f"[PDF Export Error] {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e)
        }

@app.post("/chat")
async def chat_with_case(request: ChatRequest):
    """
    Chat with case analysis using structured ETL output as grounded context

    Parameters:
        case_id: Case ID
        message: User's question
        history: Previous messages in conversation [{role, content}, ...]

    Returns:
        AI response based on case analysis
    """
    try:
        from case_manager import get_case
        import litellm

        # Get case
        case = get_case(request.case_id)
        if case is None:
            return {
                "status": "error",
                "error": f"Case {request.case_id} not found"
            }

        # Use edited version if available (expert-reviewed data)
        analysis = case.get("edits", case.get("analysis", {}))

        # Build grounded context from ETL output
        context_parts = []

        # Add all available sections (dynamic based on pipeline)
        for key, value in analysis.items():
            if not isinstance(value, list):
                continue

            # Limit chronology to first 100 events to avoid token limits
            if key == "chronology" and len(value) > 100:
                sample = value[:100]
                context_parts.append(f"{key.upper().replace('_', ' ')} ({len(value)} total events, showing first {len(sample)}):")
                context_parts.append("\n".join([str(item) for item in sample]))
            elif value:  # Only add non-empty sections
                context_parts.append(f"\n{key.upper().replace('_', ' ')} ({len(value)}):")
                for i, item in enumerate(value, 1):
                    context_parts.append(f"{i}. {item}")

        context = "\n\n".join(context_parts)

        # System prompt with grounding constraints
        system_prompt = f"""You are a medical chronology AI assistant analyzing Case {request.case_id}.

EXTRACTED CASE DATA:
{context}

CRITICAL INSTRUCTIONS:
- Answer questions using ONLY the extracted data above
- When asked about "Nth visit" or "Nth event", count by the numbered LIST POSITION (1., 2., 3., etc.), NOT by text content
  Example: "3rd event" = the item numbered "3." in the chronology, regardless of what the text says
- Always cite record IDs when referencing specific events (format: [RECORD-ID])
- If asked about something not in the data, say "This information is not available in the extracted analysis"
- Be concise and factual
- For counts/statistics, provide exact numbers from the data
- For date ranges, use YYYY-MM-DD format

Do NOT speculate, infer, or add information beyond what's explicitly in the extracted data."""

        # Build message history
        messages = [
            {"role": "system", "content": system_prompt}
        ]

        # Add conversation history
        for msg in request.history:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })

        # Add current message
        messages.append({
            "role": "user",
            "content": request.message
        })

        # Call LLM
        response = litellm.completion(
            model="claude-sonnet-4-5-20250929",
            messages=messages,
            temperature=0.1  # Low temperature for factual responses
        )

        answer = response.choices[0].message.content

        return {
            "status": "success",
            "response": answer,
            "case_id": request.case_id
        }

    except Exception as e:
        print(f"[Chat Error] {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e)
        }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)