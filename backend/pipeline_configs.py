"""
Pipeline Configuration System for ChronoScope
Enables multi-pipeline document analysis with minimal code changes
"""

PIPELINE_CONFIGS = {
    "psych_timeline": {
        "name": "Basic Timeline",
        "dataset_description": "medical and psychiatric records",
        "persona": "a forensic psychiatrist reviewing records for timeline construction",
        "extraction_model": "gpt-4o-mini",
        "analysis_model": "gpt-4o-mini",
        "extraction_prompt": """Extract from this record:

Record: {{ input }}

Return JSON with:
- date: Record date (YYYY-MM-DD)
- event_type: (evaluation, treatment, incident, hospitalization, medication_change, other)
- summary: One sentence description
- provider: Provider name if mentioned
""",
        "analysis_prompt": """Create chronological timeline of psychiatric events:

{% for record in inputs %}
{{ record.date }}: [{{ record.event_type }}] {{ record.summary }}
{% endfor %}

Return JSON with:
- timeline: List of chronological events (include date at start of each)
- treatment_gaps: Periods >60 days without documented care
""",
        "output_schema": {
            "date": "string",
            "event_type": "string",
            "summary": "string",
            "provider": "string"
        },
        "analysis_schema": {
            "timeline": "list[str]",
            "treatment_gaps": "list[str]"
        }
    },

    "psych_compliance": {
        "name": "Compliance Audit",
        "dataset_description": "medical and psychiatric records",
        "persona": "a forensic psychiatrist conducting compliance review",
        "extraction_model": "gpt-4o-mini",
        "analysis_model": "gpt-4o-mini",
        "extraction_prompt": """Extract from this record:

Record: {{ input }}

Return JSON with:
- date: Record date
- record_id: Record ID if available
- diagnoses: List of diagnoses mentioned
- medications: List of medications with doses
- treatment_plan: Treatment recommendations made
- safety_assessments: Any suicide/violence risk assessments
- informed_consent: Documentation of consent procedures
""",
        "analysis_prompt": """Audit records for psychiatric care compliance:

{% for record in inputs %}
Date {{ record.date }} ({{ record.record_id }}):
Diagnoses: {{ record.diagnoses }}
Medications: {{ record.medications }}
Treatment Plan: {{ record.treatment_plan }}
Safety: {{ record.safety_assessments }}
Consent: {{ record.informed_consent }}
---
{% endfor %}

Return JSON with:
- timeline: Chronological events with dates
- treatment_gaps: Missing follow-up or care gaps
- medication_adherence: Prescribed vs documented administration, cite record IDs
- safety_documentation: Gaps in risk assessments, cite record IDs
- consent_issues: Missing or inadequate consent documentation
""",
        "output_schema": {
            "date": "string",
            "record_id": "string",
            "diagnoses": "list[str]",
            "medications": "list[str]",
            "treatment_plan": "string",
            "safety_assessments": "string",
            "informed_consent": "string"
        },
        "analysis_schema": {
            "timeline": "list[str]",
            "treatment_gaps": "list[str]",
            "medication_adherence": "list[str]",
            "safety_documentation": "list[str]",
            "consent_issues": "list[str]"
        }
    },

    "psych_expert_witness": {
        "name": "Expert Witness Package",
        "dataset_description": "medical and psychiatric records for legal proceedings",
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
- competency_assessments: Any competency evaluations
- treatment_recommendations: Recommendations made
- patient_statements: Relevant patient statements or behaviors
- standard_of_care_issues: Potential deviations from standard care
""",
        "analysis_prompt": """Prepare expert witness analysis:

{% for record in inputs %}
{{ record.date }} - {{ record.record_id }}:
Provider: {{ record.provider }}
Diagnoses: {{ record.diagnoses }}
Meds: {{ record.medications }}
Competency: {{ record.competency_assessments }}
Recommendations: {{ record.treatment_recommendations }}
Patient Statements: {{ record.patient_statements }}
Standard of Care: {{ record.standard_of_care_issues }}
---
{% endfor %}

Return JSON with:
- timeline: Chronological psychiatric timeline with dates
- treatment_gaps: Missing care with record ID citations
- medication_adherence: Medication compliance with citations
- contradictions: Conflicting information across records with citations
- standard_of_care_deviations: Care that deviates from accepted standards with citations
- competency_timeline: Changes in patient competency over time
- expert_opinions_needed: Areas requiring expert psychiatric interpretation
""",
        "output_schema": {
            "date": "string",
            "record_id": "string",
            "provider": "string",
            "diagnoses": "list[str]",
            "medications": "list[str]",
            "competency_assessments": "string",
            "treatment_recommendations": "string",
            "patient_statements": "string",
            "standard_of_care_issues": "string"
        },
        "analysis_schema": {
            "timeline": "list[str]",
            "treatment_gaps": "list[str]",
            "medication_adherence": "list[str]",
            "contradictions": "list[str]",
            "standard_of_care_deviations": "list[str]",
            "competency_timeline": "list[str]",
            "expert_opinions_needed": "list[str]"
        }
    },

    "psych_full_discovery": {
        "name": "Full Discovery Analysis",
        "dataset_description": "complete psychiatric case file",
        "persona": "a senior forensic psychiatrist conducting comprehensive case review",
        "extraction_model": "gpt-4o-mini",
        "analysis_model": "gpt-4o-mini",
        "extraction_prompt": """Comprehensive extraction:

Record: {{ input }}

Return JSON with all fields from expert witness tier PLUS:
- date: Record date
- record_id: Record ID
- provider: Provider name
- diagnoses: Psychiatric diagnoses
- medications: Medications and doses
- competency_assessments: Any competency evaluations
- treatment_recommendations: Recommendations made
- patient_statements: Relevant patient statements or behaviors
- standard_of_care_issues: Potential deviations from standard care
- collateral_sources: Family/witness information
- functional_status: Work, social, daily functioning descriptions
- suicide_violence_history: Prior attempts or violent incidents
- substance_use: Drug/alcohol use patterns
- legal_status: Involuntary holds, court orders, criminal justice involvement
""",
        "analysis_prompt": """Comprehensive forensic psychiatric analysis:

{% for record in inputs %}
{{ record.date }} - {{ record.record_id }}:
Provider: {{ record.provider }}
Diagnoses: {{ record.diagnoses }}
Meds: {{ record.medications }}
Competency: {{ record.competency_assessments }}
Recommendations: {{ record.treatment_recommendations }}
Patient Statements: {{ record.patient_statements }}
Standard of Care: {{ record.standard_of_care_issues }}
Collateral: {{ record.collateral_sources }}
Functional Status: {{ record.functional_status }}
Suicide/Violence History: {{ record.suicide_violence_history }}
Substance Use: {{ record.substance_use }}
Legal Status: {{ record.legal_status }}
---
{% endfor %}

Return JSON with all fields from expert witness tier PLUS:
- timeline: Chronological psychiatric timeline with dates
- treatment_gaps: Missing care with record ID citations
- medication_adherence: Medication compliance with citations
- contradictions: Conflicting information across records with citations
- standard_of_care_deviations: Care that deviates from accepted standards with citations
- competency_timeline: Changes in patient competency over time
- expert_opinions_needed: Areas requiring expert psychiatric interpretation
- functional_capacity_timeline: Work/social functioning changes over time
- suicide_violence_risk_assessment: Risk factors and protective factors with citations
- substance_use_impact: How substance use affected psychiatric treatment
- legal_psychiatric_interface: Interactions between legal and psychiatric systems
- causation_analysis: Relationship between incidents and psychiatric status
- damages_assessment: Psychiatric harm and prognosis with supporting citations
""",
        "output_schema": {
            "date": "string",
            "record_id": "string",
            "provider": "string",
            "diagnoses": "list[str]",
            "medications": "list[str]",
            "competency_assessments": "string",
            "treatment_recommendations": "string",
            "patient_statements": "string",
            "standard_of_care_issues": "string",
            "collateral_sources": "string",
            "functional_status": "string",
            "suicide_violence_history": "string",
            "substance_use": "string",
            "legal_status": "string"
        },
        "analysis_schema": {
            "timeline": "list[str]",
            "treatment_gaps": "list[str]",
            "medication_adherence": "list[str]",
            "contradictions": "list[str]",
            "standard_of_care_deviations": "list[str]",
            "competency_timeline": "list[str]",
            "expert_opinions_needed": "list[str]",
            "functional_capacity_timeline": "list[str]",
            "suicide_violence_risk_assessment": "list[str]",
            "substance_use_impact": "list[str]",
            "legal_psychiatric_interface": "list[str]",
            "causation_analysis": "list[str]",
            "damages_assessment": "list[str]"
        }
    },

    "medical_chronology": {
        "name": "Medical Chronology",
        "dataset_description": "medical records from various healthcare providers",
        "persona": "a medical chronologist preparing records for legal review",
        "extraction_model": "gpt-4o-mini",  # Model for extraction phase
        "analysis_model": "gpt-4o-mini",    # Model for analysis phase (can be changed to claude-sonnet-4-20250514 for higher quality)
        "extraction_prompt": """Extract from this medical record:

Record: {{ input }}

Return JSON with:
- date: Record date (YYYY-MM-DD format)
- record_id: Record ID or identifier if mentioned (or use date as fallback)
- provider: Physician or facility name
- event_type: (visit, procedure, test, medication, hospitalization, discharge)
- event_description: One to two sentence summary of the event
- diagnosis: Diagnosis mentioned (if any)
- confidence: Confidence level (high, medium, or low)
""",
        "gleaning": {
            "num_rounds": 1,
            "validation_prompt": """Review the extracted medical event for accuracy:

Extracted data:
Date: {{ output.date }}
Provider: {{ output.provider }}
Event Type: {{ output.event_type }}
Event Description: {{ output.event_description }}
Diagnosis: {{ output.diagnosis }}

Validation criteria:
- Is the date in YYYY-MM-DD format and clearly stated in the record?
- Is the provider name clearly stated (not "unknown", "unclear", or inferred)?
- Is the event description specific and factual (not vague or assumed)?

Assign confidence level:
- "high": All fields are clearly documented with specific information
- "medium": Date is present but provider/description are partially inferred or vague
- "low": Key information is uncertain, missing, or heavily inferred

Return JSON with the original fields plus updated confidence field.
"""
        },
        "analysis_prompt": """Create chronological medical timeline and analyze for gaps:

CHRONOLOGY RECORDS:
{% for record in inputs %}
{{ record.date }} ({{ record.record_id }}): [{{ record.event_type }}] {{ record.event_description }} (Provider: {{ record.provider }}) [Confidence: {{ record.confidence }}]
{% if record.diagnosis %}Diagnosis: {{ record.diagnosis }}{% endif %}
{% endfor %}

CRITICAL ANALYSIS TASKS:
  1. Create chronology list in format above
  2. IMPORTANT: Identify ALL gaps in care >30 days between consecutive dates
  3. IMPORTANT: Identify contradictory diagnoses, medication interactions, treatment delays
  4. RED FLAG ANALYSIS (CRITICAL FOR LEGAL REVIEW):
  Identify issues with legal significance. For each red flag, specify:
  - Category: medication_error, diagnostic_contradiction, treatment_delay, documentation_gap, standard_of_care_deviation, adverse_event
  - Specific issue description
  - Record IDs and dates involved
  - Legal relevance (high/medium/low)

  Examples:
  - "Medication Error: Warfarin prescribed without baseline INR or PT monitoring (Records: RX-2024-01, LAB-2024-05, Dates: 2024-01-15 to 2024-03-30) [Legal Relevance: high]"
  - "Diagnostic Contradiction: Initial diagnosis of Type 2 Diabetes (Dr. Smith, 2024-01-10) contradicts later diagnosis of Type 1 Diabetes (Dr. Jones, 2024-02-15) with no documentation of re-evaluation (Records: VISIT-001, VISIT-008) [Legal Relevance: medium]"

Return JSON with:
- chronology: List of chronological events with format "YYYY-MM-DD: [Event Type] - Event description (Provider: X) [Confidence: high/medium/low]"
- missing_records: Gaps in care >30 days REQUIRED (format "Gap detected: YYYY-MM-DD to YYYY-MM-DD (X days) [Confidence: high/medium/low]")
- red_flags: List of red flags with format "Category: [category] | Issue: [description] | Records/Dates: [citations] | Legal Relevance: [high/medium/low]"
""",
        "output_schema": {
            "date": "string",
            "record_id": "string",
            "provider": "string",
            "event_type": "string",
            "event_description": "string",
            "diagnosis": "string",
            "confidence": "string"
        },
        "analysis_schema": {
            "chronology": "list[str]",
            "missing_records": "list[str]",
            "red_flags": "list[str]"
        }
    }
}


def get_pipeline_config(pipeline: str):
    """
    Get configuration for a specific pipeline

    Args:
        pipeline: One of "psych_timeline", "psych_compliance", "psych_expert_witness", "psych_full_discovery", "medical_chronology"

    Returns:
        Pipeline configuration dict

    Raises:
        ValueError: If pipeline is not recognized
    """
    if pipeline not in PIPELINE_CONFIGS:
        available = ", ".join(PIPELINE_CONFIGS.keys())
        raise ValueError(f"Unknown pipeline '{pipeline}'. Available pipelines: {available}")

    return PIPELINE_CONFIGS[pipeline]


def list_pipelines():
    """
    Get list of all available pipelines

    Returns:
        List of pipeline names and their human-readable titles
    """
    return [
        {"id": pipeline_id, "name": config["name"]}
        for pipeline_id, config in PIPELINE_CONFIGS.items()
    ]
