import type { Incident } from '../../shared/types/incident';
import type { WorkspaceSection } from '../store/workspaceStore';
import { getLatestSuccessfulAnalysisRun } from './getLatestSuccessfulAnalysisRun';

export type InvestigationStepId =
  | 'review-evidence'
  | 'analyze-hypothesize'
  | 'evaluate-risks'
  | 'draft-postmortem'
  | 'resolve-incident';

export type InvestigationStepState = 'completed' | 'current' | 'pending';

export interface InvestigationStep {
  id: InvestigationStepId;
  /** 1-based position in the guided flow. */
  order: number;
  label: string;
  description: string;
  state: InvestigationStepState;
  /** The workspace tab this step's action navigates to, or `null` when it targets the status selector instead of a tab. */
  targetSection: WorkspaceSection | null;
}

interface InvestigationStepDefinition {
  id: InvestigationStepId;
  label: string;
  description: string;
  targetSection: WorkspaceSection | null;
  isComplete: (incident: Incident) => boolean;
}

/**
 * The five-step guided investigation flow, in order, each with its own
 * data-derived completion check. Completion is intentionally independent
 * per step (never inferred from a previous or later step, or from
 * `incident.status` alone) so steps completed out of order -- e.g. a
 * postmortem drafted before a skeptic review was ever run -- are still
 * represented accurately rather than being masked by a simpler "highest
 * status reached" model.
 */
const STEP_DEFINITIONS: readonly InvestigationStepDefinition[] = [
  {
    id: 'review-evidence',
    label: 'Review evidence',
    description: 'Attach at least one piece of evidence to this incident.',
    targetSection: 'evidence',
    isComplete: (incident) => incident.evidence.length > 0,
  },
  {
    id: 'analyze-hypothesize',
    label: 'Analyze and hypothesize',
    description: 'Run AI analysis to generate candidate hypotheses.',
    targetSection: 'hypotheses',
    isComplete: (incident) => {
      const run = getLatestSuccessfulAnalysisRun(incident);
      return run !== null && run.hypotheses.length > 0;
    },
  },
  {
    id: 'evaluate-risks',
    label: 'Evaluate risks and skeptic review',
    description: 'Review reasoning risks and run a skeptic review of the leading hypothesis.',
    targetSection: 'ai-review',
    isComplete: (incident) => {
      const run = getLatestSuccessfulAnalysisRun(incident);
      return (run?.reasoningRisks.length ?? 0) > 0 && incident.skepticReviews.length > 0;
    },
  },
  {
    id: 'draft-postmortem',
    label: 'Draft postmortem',
    description: 'Generate a postmortem draft summarizing the investigation.',
    targetSection: 'postmortem',
    isComplete: (incident) => incident.postmortem !== null,
  },
  {
    id: 'resolve-incident',
    label: 'Resolve incident',
    description: 'Mark the incident resolved once the investigation concludes.',
    targetSection: null,
    isComplete: (incident) => incident.status === 'resolved',
  },
];

/**
 * Derives the five-step guided-investigation progress for an incident,
 * purely from its own data -- never from `status` alone. The "current"
 * step is the first incomplete step in order; if every step is already
 * complete, no step is marked "current" (all show "completed").
 *
 * @param incident The incident to derive progress for.
 * @returns The five steps, in order, each carrying its own completion state.
 */
export function getInvestigationSteps(incident: Incident): InvestigationStep[] {
  let currentAssigned = false;

  return STEP_DEFINITIONS.map((definition, index) => {
    const completed = definition.isComplete(incident);
    let state: InvestigationStepState;

    if (completed) {
      state = 'completed';
    } else if (!currentAssigned) {
      state = 'current';
      currentAssigned = true;
    } else {
      state = 'pending';
    }

    return {
      id: definition.id,
      order: index + 1,
      label: definition.label,
      description: definition.description,
      state,
      targetSection: definition.targetSection,
    };
  });
}
