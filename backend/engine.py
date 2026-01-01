import os
import json
from docetl import DSLRunner
from dotenv import load_dotenv
from pipeline_configs import get_pipeline_config
from litellm import completion_cost
import litellm
import threading

load_dotenv()

litellm.request_timeout = 300

# ============= LiteLLM Cost Tracking =============
# Thread-safe cost tracker for capturing actual LLM usage
_cost_tracker = {
    "calls": [],
    "lock": threading.Lock(),
    "operation_context": None  # Track which operation (extraction/analysis) is running
}

def track_llm_costs(kwargs, response_obj, start_time, end_time):
    """
    Callback to capture actual token usage and costs from LiteLLM calls made by DocETL.
    Automatically invoked by LiteLLM on each successful completion.
    """
    try:
        model = kwargs.get("model", "unknown")
        usage = response_obj.get("usage", {})
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        total_tokens = usage.get("total_tokens", 0)

        # Calculate actual cost using LiteLLM
        try:
            cost = completion_cost(completion_response=response_obj)
        except Exception as e:
            print(f"[Cost Tracking] Warning: Could not calculate cost: {e}")
            cost = 0.0

        # Thread-safe tracking
        with _cost_tracker["lock"]:
            _cost_tracker["calls"].append({
                "model": model,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "cost": cost,
                "operation": _cost_tracker.get("operation_context", "unknown")
            })

    except Exception as e:
        print(f"[Cost Tracking] Error in callback: {e}")

# Install the callback globally for all LiteLLM calls
litellm.success_callback = [track_llm_costs]
# ============= END Cost Tracking =============

def run_forensic_pipeline(input_data, pipeline="psych_timeline", hybrid_mode=False):
    """
    Universal Forensic Discovery Pipeline
    Uses DocETL to analyze documents

    Args:
        input_data: List of document records (JSON objects)
        pipeline: One of "psych_timeline", "psych_compliance", "psych_expert_witness", "psych_full_discovery", "medical_chronology"
        hybrid_mode: If True, uses Claude Sonnet 4 for analysis (higher quality, higher cost)

    Returns:
        Dict with "analysis" and "cost_data" keys
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

    # Get model configurations (with defaults)
    extraction_model = pipeline_config.get("extraction_model", "gpt-4o-mini")
    analysis_model = pipeline_config.get("analysis_model", "gpt-4o-mini")

    # Override analysis model if hybrid mode is enabled
    if hybrid_mode:
        analysis_model = "claude-sonnet-4-5-20250929"
        print(f"[Pipeline] Hybrid mode enabled: Using {analysis_model} for analysis")

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
                "model": extraction_model,  # Use pipeline-specific extraction model
                "prompt": pipeline_config["extraction_prompt"],
                "output": {
                    "schema": pipeline_config["output_schema"]
                },
                "pass_through": True
            },
            {
                "name": "forensic_audit",
                "type": "reduce",
                "model": analysis_model,  # Use pipeline-specific analysis model
                "reduce_key": "case_group",
                "prompt": pipeline_config["analysis_prompt"],
                "output": {
                    "schema": pipeline_config["analysis_schema"],
                    "lineage": ["date", "record_id", "provider"]
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
        runner = DSLRunner(config=config, max_threads=4, timeout_seconds=300)
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

            # Aggregate cost data from LiteLLM callbacks
            extraction_cost = 0.0
            analysis_cost = 0.0
            total_cost = 0.0
            total_tokens = 0
            llm_calls_count = 0

            with _cost_tracker["lock"]:
                llm_calls_count = len(_cost_tracker["calls"])

                # Separate costs by model and operation context
                for call in _cost_tracker["calls"]:
                    total_cost += call["cost"]
                    total_tokens += call["total_tokens"]

                    # Attribution strategy:
                    # 1. If models differ, match by model name
                    # 2. If same model for both, count first half as extraction, second half as analysis
                    # 3. This works because DocETL runs map (extraction) before reduce (analysis)
                    if extraction_model != analysis_model:
                        # Different models - easy attribution
                        if call["model"] == extraction_model:
                            extraction_cost += call["cost"]
                        elif call["model"] == analysis_model:
                            analysis_cost += call["cost"]
                    else:
                        # Same model - use call ordering (extraction happens first in DocETL)
                        call_index = _cost_tracker["calls"].index(call)
                        # Heuristic: first ~70% of calls are usually extraction (map over records)
                        extraction_ratio = len(input_data) / (len(input_data) + 1)
                        if call_index < llm_calls_count * extraction_ratio:
                            extraction_cost += call["cost"]
                        else:
                            analysis_cost += call["cost"]

                # Reset tracker for next run
                _cost_tracker["calls"] = []

            # Log cost summary
            if total_cost > 0:
                print(f"[Pipeline] Cost tracking: {llm_calls_count} LLM calls, ${total_cost:.4f} total ({total_tokens:,} tokens)")
                print(f"[Pipeline]   Extraction: ${extraction_cost:.4f} | Analysis: ${analysis_cost:.4f}")

            cost_breakdown = {
                "extraction_model": extraction_model,
                "analysis_model": analysis_model,
                "extraction_cost": extraction_cost,
                "analysis_cost": analysis_cost,
                "total_cost": total_cost,
                "total_tokens": total_tokens,
                "records_processed": len(input_data)
            }

            return {
                "analysis": analysis_output,
                "cost_data": cost_breakdown
            }
        else:
            # Return empty structure based on pipeline's analysis schema
            empty_analysis = {key: [] for key in pipeline_config["analysis_schema"].keys()}

            # Capture any costs even with empty results
            total_cost = 0.0
            total_tokens = 0
            with _cost_tracker["lock"]:
                for call in _cost_tracker["calls"]:
                    total_cost += call["cost"]
                    total_tokens += call["total_tokens"]
                _cost_tracker["calls"] = []

            cost_breakdown = {
                "extraction_model": extraction_model,
                "analysis_model": analysis_model,
                "extraction_cost": 0.0,
                "analysis_cost": 0.0,
                "total_cost": total_cost,
                "total_tokens": total_tokens,
                "records_processed": len(input_data)
            }
            return {
                "analysis": empty_analysis,
                "cost_data": cost_breakdown
            }

    except Exception as e:
        print(f"[Pipeline Error] {str(e)}")
        import traceback
        traceback.print_exc()

        # Capture any costs incurred before error
        total_cost = 0.0
        total_tokens = 0
        with _cost_tracker["lock"]:
            for call in _cost_tracker["calls"]:
                total_cost += call["cost"]
                total_tokens += call["total_tokens"]
            _cost_tracker["calls"] = []

        # Return error with any cost data captured
        error_analysis = {
            "chronology": [],
            "critical_gaps": [f"Pipeline error: {str(e)}"],
            "contradictions": []
        }
        error_cost_data = {
            "extraction_model": "unknown",
            "analysis_model": "unknown",
            "extraction_cost": 0.0,
            "analysis_cost": 0.0,
            "total_cost": total_cost,
            "total_tokens": total_tokens,
            "records_processed": 0
        }
        return {
            "analysis": error_analysis,
            "cost_data": error_cost_data
        }
