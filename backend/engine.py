import os
import json
from docetl import DSLRunner
from dotenv import load_dotenv
from pipeline_configs import get_pipeline_config

load_dotenv()

def run_forensic_pipeline(input_data, pipeline="psych_timeline"):
    """
    Universal Forensic Discovery Pipeline
    Uses DocETL to analyze documents for gaps, contradictions, and insights

    Args:
        input_data: List of document records (JSON objects)
        pipeline: One of "psych_timeline", "psych_compliance", "psych_expert_witness", "psych_full_discovery"

    Returns:
        Analysis object with pipeline-specific insights
    """

    # Get pipeline-specific configuration
    pipeline_config = get_pipeline_config(pipeline)

    # Add grouping key for reduce operation BEFORE saving to file
    for record in input_data:
        record['case_group'] = 'all'

    # Save input data to temp file (DocETL requires file-based datasets)
    input_path = "/tmp/forensic_input.json"
    with open(input_path, 'w') as f:
        json.dump(input_data, f)

    # Build DocETL config with pipeline-specific prompts and schemas
    config = {
        "default_model": "gpt-4o-mini",
        "system_prompt": {
            "dataset_description": pipeline_config["dataset_description"],
            "persona": pipeline_config["persona"]
        },
        "datasets": {
            "records": {
                "type": "file",
                "path": input_path
            }
        },
        "operations": [
            {
                "name": "extract_events",
                "type": "map",
                "prompt": pipeline_config["extraction_prompt"],
                "output": {
                    "schema": pipeline_config["output_schema"]
                },
                "pass_through": True
            },
            {
                "name": "forensic_audit",
                "type": "reduce",
                "reduce_key": "case_group",
                "prompt": pipeline_config["analysis_prompt"],
                "output": {
                    "schema": pipeline_config["analysis_schema"]
                }
            }
        ],
        "pipeline": {
            "steps": [
                {
                    "name": "extraction",
                    "input": "records",
                    "operations": ["extract_events"]
                },
                {
                    "name": "audit",
                    "input": "extraction",
                    "operations": ["forensic_audit"]
                }
            ],
            "output": {
                "type": "file",
                "path": "/tmp/forensic_analysis_output.json"
            }
        }
    }

    try:
        print(f"[Pipeline] Analyzing {len(input_data)} records...")

        # Run the pipeline (DSLRunner processes and saves to temp file)
        runner = DSLRunner(config=config, max_threads=4)
        runner.load_run_save()

        print(f"[Pipeline] Pipeline execution complete")

        # Read results from the output file
        output_path = "/tmp/forensic_analysis_output.json"
        with open(output_path, 'r') as f:
            results = json.load(f)

        print(f"[Pipeline] Loaded {len(results)} results from output file")

        # Extract and merge ALL audit results (handles multiple groups from reduce)
        if results and len(results) > 0:
            # Initialize merged results
            analysis_output = {key: [] for key in pipeline_config["analysis_schema"].keys()}

            # Merge all results together
            for result in results:
                for key in pipeline_config["analysis_schema"].keys():
                    items = result.get(key, [])
                    if isinstance(items, list):
                        analysis_output[key].extend(items)
                    else:
                        analysis_output[key].append(items)

            return analysis_output
        else:
            # Return empty structure based on pipeline's analysis schema
            return {key: [] for key in pipeline_config["analysis_schema"].keys()}

    except Exception as e:
        print(f"[Pipeline Error] {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "chronology": [],
            "critical_gaps": [f"Pipeline error: {str(e)}"],
            "contradictions": []
        }
