"""
Pipeline Configuration System for ChronoScope
Enables multi-pipeline document analysis with minimal code changes

STANDARD EVENT SCHEMA (All pipelines must extract these fields):
--------------------------------------------------------------------
Every pipeline's extraction_prompt MUST output these standardized fields:
- date: Record date (YYYY-MM-DD format) [REQUIRED]
- record_id: Unique identifier for deduplication [REQUIRED]
- event_type: Category of event (visit, evaluation, treatment, etc.) [REQUIRED]
- event_description: One or two sentence summary of what happened [REQUIRED - THE KEY FIELD]
- provider: Provider/facility name [OPTIONAL]

Additional fields (pipeline-specific, not used by chronology assembly):
- confidence: Confidence level (medical_chronology only)
- diagnosis: Diagnosis mentioned (medical_chronology only)
- [Future pipelines can add custom fields as needed]

This standard ensures engine.py can build chronologies without pipeline-specific logic.
"""

PIPELINE_CONFIGS = {
    "psych_timeline": {
        "name": "Basic Timeline",
        "dataset_description": "medical and psychiatric records",
        "persona": "a forensic psychiatrist reviewing records for timeline construction",
        "extraction_model": "gpt-4o-mini",
        "analysis_model": "gpt-4o-mini",
        "requires_llm_analysis": False,  # Python builds timeline/gaps deterministically
        "num_retries_on_validate_failure": 2,  # Retry twice on validation failure
        "extraction_validation": [
            'output["date"] != ""',       # Enforce date presence (critical for chronology)
            'output["record_id"] != ""'   # Enforce record_id for deduplication
        ],
        "extraction_prompt": """Extract from this record:

Record: {{ input }}

Return JSON with:
- date: Record date (YYYY-MM-DD)
- record_id: Record ID if mentioned (or use date as fallback)
- event_type: (evaluation, treatment, incident, hospitalization, medication_change, other)
- event_description: One to two sentence description of what happened
- provider: Provider name if mentioned
""",
        "analysis_prompt": """Create chronological timeline of psychiatric events:

{% for record in inputs %}
{{ record.date }}: [{{ record.event_type }}] {{ record.event_description }}
{% endfor %}

Return JSON with:
- timeline: List of chronological events (include date at start of each)
- treatment_gaps: Periods >30 days without documented care
""",
        "output_schema": {
            "date": "string",
            "record_id": "string",
            "event_type": "string",
            "event_description": "string",
            "provider": "string"
        },
        "analysis_schema": {
            "timeline": "list[str]",
            "treatment_gaps": "list[str]"
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

    "medical_chronology": {
        "name": "Medical Chronology",
        "dataset_description": "medical records from various healthcare providers",
        "persona": "a medical chronologist extracting structured data from records",
        "extraction_model": "gpt-4o-mini",  # Model for extraction phase
        "analysis_model": "gpt-4o-mini",  # Model for analysis phase (contradictions, red flags, expert opinions)
        "requires_llm_analysis": True,  # Needs LLM for contradictions, red flags, expert opinions
        "num_retries_on_validate_failure": 2,  # Retry twice on validation failure
        "extraction_validation": [
            'output["date"] != ""',  # Enforce date presence (critical for chronology)
            'output["record_id"] != ""'  # Enforce record_id for de-duplication
        ],
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
        "output_schema": {
            "date": "string",
            "record_id": "string",
            "provider": "string",
            "event_type": "string",
            "event_description": "string",
            "diagnosis": "string",
            "confidence": "string"
        },
        "analysis_prompt": """Perform forensic medical analysis on these records:

{% for record in inputs %}
{{ record.date }} - {{ record.record_id }}:
Provider: {{ record.provider }}
Event: [{{ record.event_type }}] {{ record.event_description }}
Diagnosis: {{ record.diagnosis }}
Confidence: {{ record.confidence }}
---
{% endfor %}

Return JSON with:
- contradictions: List of contradiction objects, each with:
  * description (string): Clear description of the contradiction found across records
  * records (list of strings): Record IDs involved (e.g., ["MRN-2024-001", "MRN-2024-002"])
  * category (string): diagnosis|treatment|timeline|documentation|medication|other
  * severity (string): critical|moderate|minor
  * legal_relevance (string): high|medium|low

- red_flags: List of red flag objects, each with:
  * category (string): Documentation Gaps|Standard of Care|Inconsistent Treatment|Missing Records|other
  * issue (string): Specific description of the issue or gap identified
  * records (list of strings): Record IDs involved
  * legal_relevance (string): high|medium|low

- expert_opinions_needed: List of expert opinion objects, each with:
  * topic (string): Brief topic heading describing area requiring expert review
  * reason (string): Why expert medical opinion is needed for this topic
  * records (list of strings): Relevant record IDs

Note: Focus on medical-legal issues relevant to litigation, malpractice review, or expert witness testimony.
""",
        "analysis_schema": {
            "contradictions": "list[dict]",
            "red_flags": "list[dict]",
            "expert_opinions_needed": "list[dict]"
        }
        # Note: chronology and missing_records are assembled in Python (engine.py)
        # This avoids LLM hallucinations and ensures perfect chronological accuracy
    }
}


def get_pipeline_config(pipeline: str):
    """
    Get configuration for a specific pipeline

    Args:
        pipeline: One of "psych_timeline", "psych_expert_witness", "medical_chronology"

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
    # MVP: Only expose medical_chronology and psych_timeline
    # Other pipelines remain in codebase for future roadmap
    MVP_PIPELINES = ["medical_chronology", "psych_timeline"]

    return [
        {"id": pipeline_id, "name": config["name"]}
        for pipeline_id, config in PIPELINE_CONFIGS.items()
        if pipeline_id in MVP_PIPELINES
    ]
