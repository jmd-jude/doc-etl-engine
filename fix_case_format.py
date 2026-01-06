#!/usr/bin/env python3
"""
Fix case file format - convert red_flags, contradictions, and expert_opinions_needed
from dict objects to formatted strings for frontend compatibility
"""

import json
import sys

def format_red_flag(flag):
    """Convert red flag dict to formatted string"""
    if isinstance(flag, str):
        return flag  # Already a string

    records = flag.get("records", [])
    records_str = ", ".join(records) if isinstance(records, list) else str(records)

    return (
        f"Category: {flag.get('category', 'unknown')} | "
        f"Issue: {flag.get('issue', 'No description')} | "
        f"Records: {records_str} | "
        f"Legal Relevance: {flag.get('legal_relevance', 'unknown')}"
    )

def format_contradiction(contradiction):
    """Convert contradiction dict to formatted string"""
    if isinstance(contradiction, str):
        return contradiction  # Already a string

    return (
        f"Records {contradiction.get('records', 'Unknown')}: "
        f"{contradiction.get('description', 'No description')} | "
        f"Legal Relevance: {contradiction.get('legal_relevance', 'unknown')}"
    )

def format_expert_opinion(opinion):
    """Convert expert opinion dict to formatted string"""
    if isinstance(opinion, str):
        return opinion  # Already a string

    records = opinion.get("records", [])
    records_str = ", ".join(records) if isinstance(records, list) else str(records)

    return (
        f"Topic: {opinion.get('topic', 'Unknown')} | "
        f"Records: {records_str} | "
        f"Reason: {opinion.get('reason', 'No description')}"
    )

def fix_case_file(case_path):
    """Fix a case file by converting objects to strings"""
    print(f"Loading case from: {case_path}")

    with open(case_path, 'r') as f:
        case_data = json.load(f)

    # Check if analysis exists
    if "analysis" not in case_data:
        print("  ❌ No analysis found in case")
        return False

    changes_made = False

    # Fix both analysis AND edits fields
    sections_to_fix = []
    if "analysis" in case_data:
        sections_to_fix.append(("analysis", case_data["analysis"]))
    if "edits" in case_data:
        sections_to_fix.append(("edits", case_data["edits"]))

    for section_name, section_data in sections_to_fix:
        print(f"\n  Checking '{section_name}' section...")

        # Fix red_flags
        if "red_flags" in section_data:
            red_flags = section_data["red_flags"]
            if red_flags and isinstance(red_flags[0], dict):
                print(f"    🔧 Converting {len(red_flags)} red_flags from dicts to strings...")
                section_data["red_flags"] = [format_red_flag(flag) for flag in red_flags]
                changes_made = True

        # Fix contradictions
        if "contradictions" in section_data:
            contradictions = section_data["contradictions"]
            if contradictions and isinstance(contradictions[0], dict):
                print(f"    🔧 Converting {len(contradictions)} contradictions from dicts to strings...")
                section_data["contradictions"] = [format_contradiction(c) for c in contradictions]
                changes_made = True

        # Fix expert_opinions_needed
        if "expert_opinions_needed" in section_data:
            opinions = section_data["expert_opinions_needed"]
            if opinions and isinstance(opinions[0], dict):
                print(f"    🔧 Converting {len(opinions)} expert opinions from dicts to strings...")
                section_data["expert_opinions_needed"] = [format_expert_opinion(op) for op in opinions]
                changes_made = True

    if changes_made:
        # Save the fixed case
        print(f"  💾 Saving fixed case...")
        with open(case_path, 'w') as f:
            json.dump(case_data, f, indent=2)
        print(f"  ✅ Case fixed successfully!")
        return True
    else:
        print(f"  ℹ️  Case already in correct format")
        return False

if __name__ == "__main__":
    case_path = "/Users/JudeHoffner/dev/doc-engine/backend/cases/20260105_203129.json"

    if len(sys.argv) > 1:
        case_path = sys.argv[1]

    print("=" * 80)
    print("Case Format Fixer - Convert objects to strings")
    print("=" * 80)

    try:
        fix_case_file(case_path)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    print("=" * 80)
    print("Done!")
    print("=" * 80)
