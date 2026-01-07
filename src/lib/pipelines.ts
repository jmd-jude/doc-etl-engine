/**
 * Pipeline configuration utilities
 * Provides human-friendly names for pipeline IDs
 */

export const PIPELINE_NAMES: { [key: string]: string } = {
  psych_timeline: 'Basic Timeline',
  psych_expert_witness: 'Expert Witness Package',
  medical_chronology: 'Medical Chronology',
};

/**
 * Get the human-friendly name for a pipeline
 * @param pipelineId - The pipeline identifier (e.g., 'psych_timeline')
 * @returns Human-friendly name (e.g., 'Basic Timeline')
 */
export function getPipelineName(pipelineId: string | undefined): string {
  if (!pipelineId) return 'Unknown';
  return PIPELINE_NAMES[pipelineId] || pipelineId.replace(/_/g, ' ');
}
