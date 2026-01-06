#!/usr/bin/env python3
"""
Quick test to verify invalid date flagging works correctly
"""

import sys
import json
sys.path.append('backend')

from engine import run_forensic_pipeline

# Test data with one invalid date
test_records = [
    {
        "date": "2023-01-18",
        "record_id": "MRN-2023-401",
        "provider": "Dr. Michael Anderson, MD",
        "facility": "Occupational Health Services",
        "record_type": "Initial Occupational Health Evaluation",
        "chief_complaint": "Psychiatric evaluation following workplace incident",
        "assessment": "Patient evaluation..."
    },
    {
        "date": "INVALID-DATE",  # This should trigger red flag
        "record_id": "MRN-2023-402",
        "provider": "Dr. Test Provider",
        "facility": "Test Facility",
        "record_type": "Test Record",
        "chief_complaint": "Test complaint",
        "assessment": "Test assessment..."
    },
    {
        "date": "2023-03-15",
        "record_id": "MRN-2023-403",
        "provider": "Dr. Another Provider",
        "facility": "Test Facility 2",
        "record_type": "Follow-up",
        "chief_complaint": "Follow-up visit",
        "assessment": "Follow-up assessment..."
    }
]

print("=" * 80)
print("Testing Invalid Date Flagging")
print("=" * 80)
print(f"\nInput: {len(test_records)} records")
print("- Record 1: Valid date (2023-01-18)")
print("- Record 2: INVALID DATE")
print("- Record 3: Valid date (2023-03-15)")
print("\n" + "=" * 80)

# Run pipeline
result = run_forensic_pipeline(test_records, pipeline="medical_chronology")

print("\n" + "=" * 80)
print("RESULTS")
print("=" * 80)

# Check red flags
red_flags = result["analysis"].get("red_flags", [])
print(f"\nRed Flags Found: {len(red_flags)}")

if red_flags:
    print("\nRed Flag Details:")
    for i, flag in enumerate(red_flags, 1):
        print(f"\n{i}. {flag}")
else:
    print("  ⚠️  WARNING: No red flags detected! Expected 1 for invalid date.")

# Check chronology count
chronology = result["analysis"].get("chronology", [])
print(f"\nChronology Entries: {len(chronology)}")
print(f"Expected: 3 (all records should be in chronology despite invalid date)")

print("\n" + "=" * 80)
print("Cost Summary")
print("=" * 80)
cost_data = result.get("cost_data", {})
print(f"Total Cost: ${cost_data.get('total_cost', 0):.4f}")
print(f"Records Processed: {cost_data.get('records_processed', 0)}")

# Test pass/fail
print("\n" + "=" * 80)
if len(red_flags) >= 1 and "INVALID-DATE" in str(red_flags):
    print("✅ TEST PASSED: Invalid date was flagged correctly!")
else:
    print("❌ TEST FAILED: Invalid date was not flagged!")
print("=" * 80)
