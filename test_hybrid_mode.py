#!/usr/bin/env python3
"""
Test hybrid_mode to verify Claude Sonnet 4.5 analysis integration
"""

import sys
import json
sys.path.append('backend')

from engine import run_forensic_pipeline

# Small test dataset with some potential red flags
test_records = [
    {
        "date": "2023-01-15",
        "record_id": "MRN-2023-001",
        "provider": "Dr. Smith, MD",
        "facility": "City Hospital",
        "record_type": "Initial Evaluation",
        "chief_complaint": "Patient reports severe chest pain",
        "assessment": "Patient presents with acute chest pain, onset 2 hours ago. ECG shows ST elevation. Patient has history of hypertension, diabetes. Blood pressure 180/110. Patient refusing recommended cardiac catheterization despite high risk presentation.",
        "plan": "Patient counseled on risks of refusing treatment. Patient signed AMA (Against Medical Advice) form. Recommended immediate cardiology consultation but patient declined."
    },
    {
        "date": "2023-01-16",
        "record_id": "MRN-2023-002",
        "provider": "Dr. Johnson, MD",
        "facility": "City Hospital ER",
        "record_type": "Emergency Visit",
        "chief_complaint": "Found unconscious at home",
        "assessment": "Patient brought in by EMS, found unconscious. Family reports patient complained of chest pain yesterday but left hospital AMA. Patient suffered massive MI (myocardial infarction). CPR performed by EMS for 15 minutes.",
        "plan": "Patient admitted to ICU. Critical condition. Family notified."
    },
    {
        "date": "2023-01-18",
        "record_id": "MRN-2023-003",
        "provider": "Dr. Williams, MD",
        "facility": "City Hospital ICU",
        "record_type": "Progress Note",
        "chief_complaint": "Post-MI management",
        "assessment": "Patient remains in critical condition following massive MI on 1/16. Neurological exam shows significant deficits consistent with anoxic brain injury from prolonged CPR. Prognosis poor.",
        "plan": "Continue supportive care. Family meeting scheduled to discuss goals of care."
    }
]

print("=" * 80)
print("HYBRID MODE TEST - Claude Sonnet 4.5 Analysis")
print("=" * 80)
print(f"\nTest Dataset: {len(test_records)} medical records")
print("\nExpected Red Flags:")
print("  - Standard of care: Patient left AMA with critical condition")
print("  - Documentation gap: What happened between 1/15 AMA and 1/16 cardiac event?")
print("  - Poor outcome following AMA discharge")
print("\n" + "=" * 80)

# Test 1: WITHOUT hybrid mode (baseline)
print("\n[TEST 1] Running WITHOUT hybrid_mode (baseline)")
print("-" * 80)
result_baseline = run_forensic_pipeline(test_records, pipeline="medical_chronology", hybrid_mode=False)

print("\n[TEST 1] RESULTS:")
print(f"  Chronology Entries: {len(result_baseline['analysis'].get('chronology', []))}")
print(f"  Red Flags: {len(result_baseline['analysis'].get('red_flags', []))}")
print(f"  Contradictions: {len(result_baseline['analysis'].get('contradictions', []))}")
print(f"  Expert Opinions Needed: {len(result_baseline['analysis'].get('expert_opinions_needed', []))}")
print(f"\n  Analysis Model: {result_baseline['cost_data'].get('analysis_model')}")
print(f"  Total Cost: ${result_baseline['cost_data'].get('total_cost', 0):.4f}")
print(f"  Analysis Cost: ${result_baseline['cost_data'].get('analysis_cost', 0):.4f}")

# Test 2: WITH hybrid mode (Claude Sonnet 4.5)
print("\n" + "=" * 80)
print("[TEST 2] Running WITH hybrid_mode=True (Claude Sonnet 4.5)")
print("-" * 80)
result_hybrid = run_forensic_pipeline(test_records, pipeline="medical_chronology", hybrid_mode=True)

print("\n[TEST 2] RESULTS:")
chronology = result_hybrid['analysis'].get('chronology', [])
red_flags = result_hybrid['analysis'].get('red_flags', [])
contradictions = result_hybrid['analysis'].get('contradictions', [])
expert_opinions = result_hybrid['analysis'].get('expert_opinions_needed', [])

print(f"  Chronology Entries: {len(chronology)}")
print(f"  Red Flags: {len(red_flags)}")
if red_flags:
    print("\n  Red Flag Details:")
    for i, flag in enumerate(red_flags, 1):
        print(f"    {i}. {flag}")

print(f"\n  Contradictions: {len(contradictions)}")
if contradictions:
    print("\n  Contradiction Details:")
    for i, contradiction in enumerate(contradictions, 1):
        print(f"    {i}. {contradiction}")

print(f"\n  Expert Opinions Needed: {len(expert_opinions)}")
if expert_opinions:
    print("\n  Expert Opinion Details:")
    for i, opinion in enumerate(expert_opinions, 1):
        print(f"    {i}. {opinion}")

print(f"\n  Analysis Model: {result_hybrid['cost_data'].get('analysis_model')}")
print(f"  Total Cost: ${result_hybrid['cost_data'].get('total_cost', 0):.4f}")
print(f"    - Extraction: ${result_hybrid['cost_data'].get('extraction_cost', 0):.4f}")
print(f"    - Analysis: ${result_hybrid['cost_data'].get('analysis_cost', 0):.4f}")

# Validation
print("\n" + "=" * 80)
print("VALIDATION")
print("=" * 80)

checks_passed = 0
checks_total = 5

# Check 1: Baseline should use "python" for analysis
if result_baseline['cost_data'].get('analysis_model') == "python":
    print("✅ Check 1: Baseline uses 'python' for analysis")
    checks_passed += 1
else:
    print(f"❌ Check 1: Expected 'python', got '{result_baseline['cost_data'].get('analysis_model')}'")

# Check 2: Hybrid should use Claude model
if "claude" in result_hybrid['cost_data'].get('analysis_model', '').lower():
    print("✅ Check 2: Hybrid mode uses Claude model")
    checks_passed += 1
else:
    print(f"❌ Check 2: Expected Claude model, got '{result_hybrid['cost_data'].get('analysis_model')}'")

# Check 3: Hybrid should have analysis cost > 0
if result_hybrid['cost_data'].get('analysis_cost', 0) > 0:
    print("✅ Check 3: Hybrid mode incurred analysis costs")
    checks_passed += 1
else:
    print("❌ Check 3: No analysis costs detected in hybrid mode")

# Check 4: Hybrid should have more red flags than baseline
if len(red_flags) > len(result_baseline['analysis'].get('red_flags', [])):
    print("✅ Check 4: Hybrid mode detected more red flags")
    checks_passed += 1
else:
    print(f"❌ Check 4: Expected more red flags (baseline: {len(result_baseline['analysis'].get('red_flags', []))}, hybrid: {len(red_flags)})")

# Check 5: Both should have same chronology count
if len(chronology) == len(result_baseline['analysis'].get('chronology', [])):
    print("✅ Check 5: Chronology count unchanged (Python assembly works)")
    checks_passed += 1
else:
    print("❌ Check 5: Chronology counts differ (Python assembly issue)")

print(f"\n{'='*80}")
if checks_passed == checks_total:
    print(f"✅ ALL CHECKS PASSED ({checks_passed}/{checks_total})")
else:
    print(f"⚠️  SOME CHECKS FAILED ({checks_passed}/{checks_total})")
print("=" * 80)
