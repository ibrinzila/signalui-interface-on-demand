import { stableHash } from './hash.js';
import type {
  AdaptationExplanation,
  Anomaly,
  InterfaceContext,
  SurfacePlan,
  SurfaceRecipeId,
  SurfaceRegion,
  WorkspaceState,
} from './types.js';

const severityRank: Readonly<Record<Anomaly['severity'], number>> = {
  critical: 3,
  high: 2,
  medium: 1,
};

function actionable(anomaly: Anomaly): boolean {
  return anomaly.requiresHumanDecision && anomaly.status !== 'corrected' && anomaly.status !== 'held';
}

function sortActionable(anomalies: readonly Anomaly[]): Anomaly[] {
  return anomalies
    .filter(actionable)
    .sort((left, right) => {
      const severity = severityRank[right.severity] - severityRank[left.severity];
      if (severity !== 0) return severity;
      return left.reportedAt.localeCompare(right.reportedAt);
    });
}

function recipeFor(context: InterfaceContext): SurfaceRecipeId {
  if (context.intent === 'audit-recent-decisions') return 'audit-trail';
  if (context.intent === 'resolve-actionable-anomalies') return 'focused-decisions';
  return 'full-workspace';
}

function region(id: string, title: string, anomalyIds: readonly string[] = []): SurfaceRegion {
  return { id, title, anomalyIds: [...anomalyIds] };
}

function explanationFor(
  recipe: SurfaceRecipeId,
  context: InterfaceContext,
  selected: readonly Anomaly[],
): AdaptationExplanation {
  const explicitInputs = [
    `Role: ${context.role}`,
    `Intent: ${context.intent}`,
    `Device: ${context.device}`,
    `Decision budget: ${context.decisionBudget}`,
    `User statement: ${context.explicitUserStatement}`,
  ];

  if (recipe === 'focused-decisions') {
    return {
      goal: 'Resolve only the anomalies that currently require human judgement.',
      explicitInputs,
      changed: [
        `Reduced the workspace to ${selected.length} primary decisions.`,
        'Collapsed portfolio configuration, reporting and unrelated history.',
        `Optimised controls for ${context.device}.`,
      ],
      preserved: [
        'All material evidence and counterevidence for the selected cases.',
        'The same role, command permissions and state-version checks as the full workspace.',
        'Exact approval previews and reversal controls.',
      ],
      notInferred: ['Disability', 'Emotion', 'Cognitive capacity'],
    };
  }

  if (recipe === 'audit-trail') {
    return {
      goal: 'Review recent decisions, authority and provenance without mutating operational state.',
      explicitInputs,
      changed: ['Prioritised receipts, state hashes and evidence provenance.', 'Suppressed mutation controls.'],
      preserved: ['Complete decision lineage.', 'Material evidence references.', 'Full workspace reversal control.'],
      notInferred: ['Disability', 'Emotion', 'Cognitive capacity'],
    };
  }

  return {
    goal: 'Maintain portfolio awareness and access to all operational queues.',
    explicitInputs,
    changed: ['No regions were removed; the complete workspace is visible.'],
    preserved: ['All anomalies, evidence, history, activity and governed controls.'],
    notInferred: ['Disability', 'Emotion', 'Cognitive capacity'],
  };
}

function regionsFor(recipe: SurfaceRecipeId, ids: readonly string[]): SurfaceRegion[] {
  switch (recipe) {
    case 'focused-decisions':
      return [
        region('focus-progress', 'Decision progress', ids),
        region('material-evidence', 'Material evidence and counterevidence', ids),
        region('decision-cards', 'Decisions requiring attention', ids),
        region('exact-action-preview', 'Exact action preview', ids),
        region('adaptation-explanation', 'Why this interface', ids),
        region('reversal-controls', 'Interface controls', ids),
      ];
    case 'audit-trail':
      return [
        region('audit-summary', 'Audit summary', ids),
        region('receipt-timeline', 'Receipt timeline', ids),
        region('evidence-provenance', 'Evidence provenance', ids),
        region('state-hashes', 'State continuity', ids),
        region('adaptation-explanation', 'Why this interface', ids),
        region('reversal-controls', 'Interface controls', ids),
      ];
    case 'full-workspace':
      return [
        region('workspace-header', 'Operations workspace', ids),
        region('portfolio-summary', 'Portfolio summary', ids),
        region('anomaly-queue', 'Anomaly queue', ids),
        region('history-overview', 'Reading history', ids),
        region('activity', 'Recent activity', ids),
        region('adaptation-explanation', 'Why this interface', ids),
        region('reversal-controls', 'Interface controls', ids),
      ];
  }
}

export function compileSurface(context: InterfaceContext, state: WorkspaceState): SurfacePlan {
  const recipe = recipeFor(context);
  const selected = recipe === 'focused-decisions'
    ? sortActionable(state.anomalies).slice(0, Math.max(1, Math.min(context.decisionBudget, 8)))
    : [...state.anomalies];
  const primaryAnomalyIds = selected.map((anomaly) => anomaly.id);
  const hiddenRegions = recipe === 'focused-decisions'
    ? ['portfolio-summary', 'institution-settings', 'reporting-navigation', 'historical-export']
    : recipe === 'audit-trail'
      ? ['mutation-controls', 'institution-settings', 'reporting-navigation']
      : [];
  const explanation = explanationFor(recipe, context, selected);
  const stateHash = stableHash({
    workspaceVersion: state.version,
    anomalyVersions: state.anomalies.map((anomaly) => [anomaly.id, anomaly.version, anomaly.status]),
    receipts: state.receipts.map((receipt) => receipt.id),
  });

  return {
    id: `${recipe}:${state.version}:${stableHash(context)}`,
    recipe,
    regions: regionsFor(recipe, primaryAnomalyIds),
    primaryAnomalyIds,
    hiddenRegions,
    explanation,
    stateHash,
  };
}
