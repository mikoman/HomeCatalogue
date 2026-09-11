const activeScansKey = (roomId) => `homeCatalogue:activeScans:${roomId}`;
const reviewKey = (sessionId) => `homeCatalogue:review:${sessionId}`;

export function readActiveScans(roomId, storage) {
  try {
    const value = JSON.parse((storage ?? globalThis.localStorage).getItem(activeScansKey(roomId)) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && id.length > 0))] : [];
  } catch {
    return [];
  }
}

export function writeActiveScans(roomId, sessionIds, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(activeScansKey(roomId), JSON.stringify([...new Set(sessionIds)]));
    return true;
  } catch {
    return false;
  }
}

export function enqueueRoomScan(roomId, sessionId, storage) {
  return writeActiveScans(roomId, [...readActiveScans(roomId, storage), sessionId], storage);
}

function validReviewDraft(draft) {
  if (!draft || typeof draft.resultRevision !== 'string' || !Array.isArray(draft.result?.items) || !Array.isArray(draft.result?.proposed_containers)) return false;
  const optionalText = value => value == null || typeof value === 'string';
  if (!draft.result.items.every(item => item && typeof item.name === 'string'
    && optionalText(item.category) && optionalText(item.notes) && optionalText(item.suggested_container)
    && Array.isArray(item.tags || []) && (item.tags || []).every(tag => typeof tag === 'string')
    && (item.bbox == null || (Array.isArray(item.bbox) && item.bbox.length === 4 && item.bbox.every(Number.isFinite)))
    && (item.confidence_score == null || Number.isFinite(item.confidence_score)))) return false;
  if (!draft.result.proposed_containers.every(container => container && typeof container.name === 'string' && optionalText(container.description))) return false;
  if (!Array.isArray(draft.existingContainers) || !draft.existingContainers.every(container => container && typeof container.name === 'string' && Number.isInteger(container.id))) return false;
  const count = draft.result.items.length;
  if (![draft.itemTargets, draft.containerFlags, draft.dupeMatches, draft.itemSkip].every(value => Array.isArray(value) && value.length === count)) return false;
  if (![...draft.itemSkip, ...draft.containerFlags].every(value => typeof value === 'boolean')) return false;
  if (!draft.dupeMatches.every(value => value === null || (value && typeof value.name === 'string'))) return false;
  if (![draft.proposedSkip, draft.proposedTargets].every(value => Array.isArray(value) && value.length === draft.result.proposed_containers.length)) return false;
  if (!draft.proposedSkip.every(value => typeof value === 'boolean')) return false;
  return [...draft.itemTargets, ...draft.proposedTargets].every(target => target && (target.kind === 'loose'
    || (target.kind === 'missing' && Number.isInteger(target.containerId) && typeof target.name === 'string')
    || (target.kind === 'existing' && Number.isInteger(target.containerId) && target.containerId > 0)
    || (target.kind === 'proposed' && typeof target.name === 'string')));
}

export function readReviewDraft(sessionId, storage) {
  try {
    const draft = JSON.parse((storage ?? globalThis.localStorage).getItem(reviewKey(sessionId)) || 'null');
    if (!validReviewDraft(draft)) return null;
    const { result, resultRevision, existingContainers, itemTargets, containerFlags, dupeMatches, itemSkip, proposedSkip, proposedTargets } = draft;
    return { result, resultRevision, existingContainers, itemTargets, containerFlags, dupeMatches, itemSkip, proposedSkip, proposedTargets };
  } catch {
    return null;
  }
}

export function writeReviewDraft(sessionId, draft, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(reviewKey(sessionId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearReviewDraft(sessionId, storage) {
  try { (storage ?? globalThis.localStorage).removeItem(reviewKey(sessionId)); } catch { /* Storage can be unavailable in private browsing. */ }
}
