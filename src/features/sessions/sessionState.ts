import { rankRecipes } from '../../lib/color/mixEngine';
import { createId } from '../../lib/utils/id';
import type {
  AppState,
  MixStatus,
  Paint,
  PaintingSession,
  PaintingTarget,
  PrepStatus,
  RankedRecipe,
  SessionStatus,
  TargetPriority,
  TargetValueRole,
  UserSettings,
} from '../../types/models';

export type SessionDraft = {
  title: string;
  notes?: string;
  subject?: string;
  lightingNotes?: string;
  moodNotes?: string;
  canvasNotes?: string;
  status?: SessionStatus;
};

export type TargetDraft = {
  label: string;
  targetHex: string;
  notes?: string;
  area?: string;
  family?: string;
  priority?: TargetPriority;
  valueRole?: TargetValueRole;
  tags?: string[];
};

const nowIso = (): string => new Date().toISOString();

export const createPaintingTarget = (draft: TargetDraft): PaintingTarget => ({
  id: createId('target'),
  label: draft.label.trim() || 'Untitled target',
  targetHex: draft.targetHex,
  notes: draft.notes?.trim() || undefined,
  area: draft.area?.trim() || undefined,
  family: draft.family?.trim() || undefined,
  priority: draft.priority ?? 'primary',
  recipeOptions: [],
  selectedRecipeId: undefined,
  selectedRecipe: undefined,
  mixStatus: 'not-mixed',
  prepStatus: 'unreviewed',
  tags: draft.tags?.filter(Boolean) ?? [],
  valueRole: draft.valueRole,
});

export const createPaintingSession = (draft?: Partial<SessionDraft>): PaintingSession => {
  const timestamp = nowIso();
  return {
    id: createId('session'),
    title: draft?.title?.trim() || 'Untitled painting project',
    createdAt: timestamp,
    updatedAt: timestamp,
    status: draft?.status ?? 'planning',
    notes: draft?.notes?.trim() || undefined,
    subject: draft?.subject?.trim() || undefined,
    lightingNotes: draft?.lightingNotes?.trim() || undefined,
    moodNotes: draft?.moodNotes?.trim() || undefined,
    canvasNotes: draft?.canvasNotes?.trim() || undefined,
    referenceImage: undefined,
    extractedCandidatePalette: [],
    sampledColors: [],
    targetOrder: [],
    targets: [],
    activeTargetIds: [],
    pinnedTargetIds: [],
  };
};

const touchSession = (session: PaintingSession): PaintingSession => ({ ...session, updatedAt: nowIso() });

const mapSessionTargets = (session: PaintingSession, updater: (target: PaintingTarget) => PaintingTarget): PaintingSession => {
  const targets = session.targets.map(updater);
  return touchSession({ ...session, targets });
};

export const addTargetToSession = (session: PaintingSession, draft: TargetDraft): PaintingSession => {
  const target = createPaintingTarget(draft);
  return touchSession({
    ...session,
    targets: [...session.targets, target],
    targetOrder: [...session.targetOrder, target.id],
  });
};

export const updateSessionMeta = (session: PaintingSession, patch: Partial<SessionDraft>): PaintingSession =>
  touchSession({
    ...session,
    title: patch.title !== undefined ? patch.title.trim() || session.title : session.title,
    notes: patch.notes !== undefined ? patch.notes.trim() || undefined : session.notes,
    subject: patch.subject !== undefined ? patch.subject.trim() || undefined : session.subject,
    lightingNotes: patch.lightingNotes !== undefined ? patch.lightingNotes.trim() || undefined : session.lightingNotes,
    moodNotes: patch.moodNotes !== undefined ? patch.moodNotes.trim() || undefined : session.moodNotes,
    canvasNotes: patch.canvasNotes !== undefined ? patch.canvasNotes.trim() || undefined : session.canvasNotes,
    status: patch.status ?? session.status,
  });

export const updateTargetInSession = (session: PaintingSession, targetId: string, patch: Partial<TargetDraft> & { prepStatus?: PrepStatus; mixStatus?: MixStatus }): PaintingSession =>
  mapSessionTargets(session, (target) => {
    if (target.id !== targetId) {
      return target;
    }
    return {
      ...target,
      label: patch.label !== undefined ? patch.label.trim() || target.label : target.label,
      targetHex: patch.targetHex ?? target.targetHex,
      notes: patch.notes !== undefined ? patch.notes.trim() || undefined : target.notes,
      area: patch.area !== undefined ? patch.area.trim() || undefined : target.area,
      family: patch.family !== undefined ? patch.family.trim() || undefined : target.family,
      priority: patch.priority ?? target.priority,
      valueRole: patch.valueRole ?? target.valueRole,
      tags: patch.tags ?? target.tags,
      prepStatus: patch.prepStatus ?? target.prepStatus,
      mixStatus: patch.mixStatus ?? target.mixStatus,
    };
  });

export const removeTargetFromSession = (session: PaintingSession, targetId: string): PaintingSession =>
  touchSession({
    ...session,
    targets: session.targets.filter((target) => target.id !== targetId),
    targetOrder: session.targetOrder.filter((id) => id !== targetId),
    activeTargetIds: session.activeTargetIds.filter((id) => id !== targetId),
    pinnedTargetIds: session.pinnedTargetIds.filter((id) => id !== targetId),
  });

export const moveTargetWithinSession = (session: PaintingSession, targetId: string, direction: 'up' | 'down'): PaintingSession => {
  const index = session.targetOrder.indexOf(targetId);
  if (index < 0) {
    return session;
  }
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= session.targetOrder.length) {
    return session;
  }
  const targetOrder = [...session.targetOrder];
  [targetOrder[index], targetOrder[nextIndex]] = [targetOrder[nextIndex], targetOrder[index]];
  return touchSession({ ...session, targetOrder });
};

export const generateRecipesForSessionTarget = (
  session: PaintingSession,
  targetId: string,
  paints: Paint[],
  settings: UserSettings,
  limit = 6,
): PaintingSession => {
  const target = session.targets.find((item) => item.id === targetId);
  if (!target) {
    return session;
  }

  const recipes = rankRecipes(target.targetHex, paints, settings, limit);
  return mapSessionTargets(session, (item) => {
    if (item.id !== targetId) {
      return item;
    }

    const selectedRecipe = item.selectedRecipeId ? recipes.find((recipe) => recipe.id === item.selectedRecipeId) : undefined;
    return {
      ...item,
      recipeOptions: recipes,
      selectedRecipeId: selectedRecipe?.id ?? item.selectedRecipeId ?? recipes[0]?.id,
      selectedRecipe: selectedRecipe ?? item.selectedRecipe ?? recipes[0],
      prepStatus: recipes.length > 0 ? 'reviewed' : item.prepStatus,
    };
  });
};

export const selectRecipeForTarget = (session: PaintingSession, targetId: string, recipeId: string, lock = false): PaintingSession =>
  touchSession({
    ...session,
    activeTargetIds: session.activeTargetIds.includes(targetId) ? session.activeTargetIds : [...session.activeTargetIds, targetId],
    targets: session.targets.map((target) => {
      if (target.id !== targetId) {
        return target;
      }
      const selectedRecipe = target.recipeOptions.find((recipe) => recipe.id === recipeId);
      return {
        ...target,
        selectedRecipeId: selectedRecipe?.id ?? recipeId,
        selectedRecipe: selectedRecipe ?? target.selectedRecipe,
        prepStatus: lock ? 'locked' : 'reviewed',
      };
    }),
  });

export const toggleActiveTarget = (session: PaintingSession, targetId: string): PaintingSession => {
  const activeTargetIds = session.activeTargetIds.includes(targetId)
    ? session.activeTargetIds.filter((id) => id !== targetId)
    : [...session.activeTargetIds, targetId];
  return touchSession({ ...session, activeTargetIds });
};

export const togglePinnedTarget = (session: PaintingSession, targetId: string): PaintingSession => {
  const pinnedTargetIds = session.pinnedTargetIds.includes(targetId)
    ? session.pinnedTargetIds.filter((id) => id !== targetId)
    : [...session.pinnedTargetIds, targetId];
  return touchSession({ ...session, pinnedTargetIds });
};

export const setTargetMixStatus = (session: PaintingSession, targetId: string, mixStatus: MixStatus): PaintingSession =>
  updateTargetInSession(session, targetId, { mixStatus });

export const duplicateTargetForRemix = (session: PaintingSession, targetId: string): PaintingSession => {
  const source = session.targets.find((target) => target.id === targetId);
  if (!source) {
    return session;
  }
  const duplicate: PaintingTarget = {
    ...source,
    id: createId('target'),
    label: `${source.label} remix`,
    prepStatus: 'reviewed',
    mixStatus: 'not-mixed',
  };
  return touchSession({
    ...session,
    targets: [...session.targets, duplicate],
    targetOrder: [...session.targetOrder, duplicate.id],
    activeTargetIds: [...new Set([...session.activeTargetIds, duplicate.id])],
  });
};

export const duplicatePaintingSession = (session: PaintingSession): PaintingSession => {
  const timestamp = nowIso();
  const idMap = new Map(session.targets.map((target) => [target.id, createId('target')]));
  const targets = session.targets.map((target) => ({
    ...target,
    id: idMap.get(target.id) ?? createId('target'),
    label: `${target.label}`,
  }));
  return {
    ...session,
    id: createId('session'),
    title: `${session.title} copy`,
    createdAt: timestamp,
    updatedAt: timestamp,
    targetOrder: session.targetOrder.map((id) => idMap.get(id) ?? id),
    activeTargetIds: session.activeTargetIds.map((id) => idMap.get(id) ?? id),
    pinnedTargetIds: session.pinnedTargetIds.map((id) => idMap.get(id) ?? id),
    targets,
  };
};

export const sortTargetsForView = (
  session: PaintingSession,
  mode: 'custom' | 'light-to-dark' | 'warm-to-cool' | 'primary-first' | 'pinned-first' | 'not-mixed-first',
): PaintingTarget[] => {
  const ordered = session.targetOrder
    .map((id) => session.targets.find((target) => target.id === id))
    .filter((target): target is PaintingTarget => Boolean(target));

  const withIndex = ordered.map((target, index) => ({ target, index }));
  const priorityRank: Record<NonNullable<PaintingTarget['priority']>, number> = { primary: 0, secondary: 1, optional: 2 };
  const mixRank: Record<MixStatus, number> = { 'not-mixed': 0, 'remix-needed': 1, adjusted: 2, mixed: 3 };

  const getWarmness = (target: PaintingTarget): number => {
    const hue = target.selectedRecipe?.targetAnalysis.hue ?? target.selectedRecipe?.predictedAnalysis.hue ?? null;
    if (hue === null) return 180;
    return hue <= 180 ? hue : 360 - hue;
  };

  return [...withIndex]
    .sort((left, right) => {
      const leftPinned = session.pinnedTargetIds.includes(left.target.id);
      const rightPinned = session.pinnedTargetIds.includes(right.target.id);
      if (mode === 'pinned-first' && leftPinned !== rightPinned) {
        return leftPinned ? -1 : 1;
      }
      if (mode === 'not-mixed-first' && left.target.mixStatus !== right.target.mixStatus) {
        return mixRank[left.target.mixStatus] - mixRank[right.target.mixStatus];
      }
      if (mode === 'primary-first') {
        return priorityRank[left.target.priority ?? 'secondary'] - priorityRank[right.target.priority ?? 'secondary'] || left.index - right.index;
      }
      if (mode === 'light-to-dark') {
        const leftValue = left.target.selectedRecipe?.targetAnalysis.value ?? 0;
        const rightValue = right.target.selectedRecipe?.targetAnalysis.value ?? 0;
        return rightValue - leftValue || left.index - right.index;
      }
      if (mode === 'warm-to-cool') {
        return getWarmness(left.target) - getWarmness(right.target) || left.index - right.index;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.target);
};

export const updateStateSessions = (state: AppState, sessionId: string, updater: (session: PaintingSession) => PaintingSession): AppState => ({
  ...state,
  sessions: state.sessions.map((session) => (session.id === sessionId ? updater(session) : session)),
});

export const getSessionById = (sessions: PaintingSession[], sessionId: string | null | undefined): PaintingSession | null =>
  sessions.find((session) => session.id === sessionId) ?? null;

export const getActivePaintingTargets = (session: PaintingSession): PaintingTarget[] => {
  const activeIds = session.activeTargetIds.length > 0 ? session.activeTargetIds : session.targets.filter((target) => target.selectedRecipe).map((target) => target.id);
  return activeIds.map((id) => session.targets.find((target) => target.id === id)).filter((target): target is PaintingTarget => Boolean(target));
};

export const summarizeSession = (session: PaintingSession) => ({
  targetCount: session.targets.length,
  lockedCount: session.targets.filter((target) => target.prepStatus === 'locked').length,
  selectedCount: session.targets.filter((target) => target.selectedRecipe).length,
  activeCount: getActivePaintingTargets(session).length,
});

export const createStarterSessionState = (state: AppState, title = 'New painting session'): AppState => {
  const session = createPaintingSession({ title });
  return {
    ...state,
    sessions: [session, ...state.sessions],
    currentSessionId: session.id,
  };
};
