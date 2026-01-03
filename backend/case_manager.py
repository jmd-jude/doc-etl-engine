"""
Case Management System for InsightStream Forensic
Handles case tracking, status updates, and data persistence
"""

import json
import os
from copy import deepcopy
from datetime import datetime
from typing import List, Dict, Optional

CASES_DIR = os.path.join(os.path.dirname(__file__), "cases")

def ensure_cases_dir():
    """Create cases directory if it doesn't exist"""
    os.makedirs(CASES_DIR, exist_ok=True)

def generate_case_id():
    """Generate a simple timestamp-based case ID"""
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def create_case(customer_name: str, customer_email: str, pipeline: str, records_count: int) -> str:
    """
    Create a new case record

    Args:
        customer_name: Customer's name
        customer_email: Customer's email
        pipeline: Pipeline type (psych_timeline, psych_compliance, psych_expert_witness, psych_full_discovery)
        records_count: Number of records uploaded

    Returns:
        Case ID
    """
    ensure_cases_dir()

    case_id = generate_case_id()
    case = {
        "id": case_id,
        "customer_name": customer_name,
        "customer_email": customer_email,
        "pipeline": pipeline,
        "records_count": records_count,
        "uploaded_at": datetime.now().isoformat(),
        "status": "processing",  # processing, pending_review, approved, delivered
        "estimated_cost_per_page": 0.15
    }

    case_path = os.path.join(CASES_DIR, f"{case_id}.json")
    with open(case_path, "w") as f:
        json.dump(case, f, indent=2)

    print(f"[Case Manager] Created case {case_id} for {customer_name}")
    return case_id

def update_case_analysis(case_id: str, analysis: Dict, original_records: List[Dict] = None):
    """
    Update case with analysis results and move to pending_review status

    Args:
        case_id: Case ID
        analysis: Analysis results dict
        original_records: Optional list of original source records (for provenance tracking)
    """
    ensure_cases_dir()
    case_path = os.path.join(CASES_DIR, f"{case_id}.json")

    if not os.path.exists(case_path):
        print(f"[Case Manager] Warning: Case {case_id} not found")
        return

    with open(case_path, "r") as f:
        case = json.load(f)

    case["analysis"] = analysis
    case["status"] = "pending_review"
    case["analyzed_at"] = datetime.now().isoformat()

    # Initialize edits as deep copy of analysis (user can modify without affecting original)
    case["edits"] = deepcopy(analysis)

    # Store original records for provenance tracking (view source feature)
    if original_records is not None:
        case["original_records"] = original_records
        print(f"[Case Manager] Stored {len(original_records)} original source records")

    with open(case_path, "w") as f:
        json.dump(case, f, indent=2)

    print(f"[Case Manager] Updated case {case_id} with analysis results")

def get_case(case_id: str) -> Optional[Dict]:
    """
    Get case by ID

    Args:
        case_id: Case ID

    Returns:
        Case dict or None if not found
    """
    ensure_cases_dir()
    case_path = os.path.join(CASES_DIR, f"{case_id}.json")

    if not os.path.exists(case_path):
        return None

    with open(case_path, "r") as f:
        return json.load(f)

def list_cases() -> List[Dict]:
    """
    List all cases, sorted by upload date (newest first)

    Returns:
        List of case dicts
    """
    ensure_cases_dir()

    cases = []
    for filename in os.listdir(CASES_DIR):
        if filename.endswith(".json"):
            case_path = os.path.join(CASES_DIR, filename)
            with open(case_path, "r") as f:
                cases.append(json.load(f))

    # Sort by uploaded_at (newest first)
    cases.sort(key=lambda x: x.get("uploaded_at", ""), reverse=True)

    return cases

def update_case_edits(case_id: str, edits: Dict, comments: Dict = None):
    """
    Update case with edited analysis results and expert comments

    Args:
        case_id: Case ID
        edits: Edited analysis dict (same structure as analysis)
        comments: Expert comments dict (optional)
    """
    ensure_cases_dir()
    case_path = os.path.join(CASES_DIR, f"{case_id}.json")

    if not os.path.exists(case_path):
        print(f"[Case Manager] Warning: Case {case_id} not found")
        return

    with open(case_path, "r") as f:
        case = json.load(f)

    case["edits"] = edits
    case["last_edited"] = datetime.now().isoformat()

    # Save comments if provided
    if comments is not None:
        case["comments"] = comments
        print(f"[Case Manager] Updated comments for case {case_id}")

    with open(case_path, "w") as f:
        json.dump(case, f, indent=2)

    print(f"[Case Manager] Updated edits for case {case_id}")

def update_case_status(case_id: str, status: str):
    """
    Update case status

    Args:
        case_id: Case ID
        status: New status (processing, pending_review, approved, delivered)
    """
    ensure_cases_dir()
    case_path = os.path.join(CASES_DIR, f"{case_id}.json")

    if not os.path.exists(case_path):
        print(f"[Case Manager] Warning: Case {case_id} not found")
        return

    with open(case_path, "r") as f:
        case = json.load(f)

    case["status"] = status
    case[f"{status}_at"] = datetime.now().isoformat()

    with open(case_path, "w") as f:
        json.dump(case, f, indent=2)

    print(f"[Case Manager] Updated case {case_id} status to {status}")

def update_case_costs(case_id: str, cost_data: Dict):
    """
    Update case with actual processing costs

    Args:
        case_id: Case ID
        cost_data: Dict with extraction_cost, analysis_cost, total_cost, total_tokens, etc.
    """
    ensure_cases_dir()
    case_path = os.path.join(CASES_DIR, f"{case_id}.json")

    if not os.path.exists(case_path):
        print(f"[Case Manager] Warning: Case {case_id} not found")
        return

    # Skip saving if all costs are zero (no LLM calls were made, likely cache hit)
    if cost_data.get("total_cost", 0) == 0:
        print(f"[Case Manager] No costs to track for case {case_id} (likely cache hit)")
        return

    with open(case_path, "r") as f:
        case = json.load(f)

    # Calculate cost per page
    records_count = case.get("records_count", cost_data.get("records_processed", 0))
    cost_per_page = cost_data["total_cost"] / records_count if records_count > 0 else 0

    # Update case with actual costs
    case["actual_cost"] = cost_data["total_cost"]
    case["cost_per_page"] = cost_per_page
    case["cost_breakdown"] = cost_data

    with open(case_path, "w") as f:
        json.dump(case, f, indent=2)

    print(f"[Case Manager] Updated costs for case {case_id}: ${cost_data['total_cost']:.4f} (${cost_per_page:.4f}/page)")
