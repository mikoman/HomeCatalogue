import { normalizeName } from './normalizeName.js';

function siblingMatches(containers, name, parentId) {
  return containers.filter(container => normalizeName(container.name) === normalizeName(name) && (container.parent_id ?? null) === parentId);
}

export function prepareReview(entry, existingContainers, existingItems) {
  const proposed = entry.result.proposed_containers || [];
  const defaultParentId = entry.containerId ?? null;
  return {
    ...entry,
    existingContainers,
    itemTargets: entry.result.items.map(item => {
      const fallback = entry.containerId ? { kind: 'existing', containerId: entry.containerId } : { kind: 'loose' };
      if (!item.suggested_container) return fallback;
      const matches = siblingMatches(existingContainers, item.suggested_container, defaultParentId);
      if (matches.length === 1) return { kind: 'existing', containerId: matches[0].id };
      if (matches.length > 1) return fallback;
      const proposedMatches = proposed.filter(container => normalizeName(container.name) === normalizeName(item.suggested_container));
      if (proposedMatches.length === 1) return { kind: 'proposed', name: proposedMatches[0].name };
      return fallback;
    }),
    containerFlags: entry.result.items.map(() => false),
    dupeMatches: entry.result.items.map(item => existingItems.find(existing => normalizeName(existing.name) === normalizeName(item.name)) || null),
    itemSkip: entry.result.items.map(() => false),
    proposedSkip: proposed.map(container => siblingMatches(existingContainers, container.name, defaultParentId).length === 1),
    proposedTargets: proposed.map(() => defaultParentId ? { kind: 'existing', containerId: defaultParentId } : { kind: 'loose' }),
  };
}

export function reconcileReview(entry, existingContainers, existingItems = []) {
  if (!entry.existingContainers) entry = prepareReview(entry, existingContainers, existingItems);
  const available = new Set(existingContainers.map(container => container.id));
  const reconcileTarget = target => {
    if (target?.kind !== 'existing' || available.has(target.containerId)) return target || { kind: 'loose' };
    const old = entry.existingContainers.find(container => container.id === target.containerId);
    return { kind: 'missing', containerId: target.containerId, name: old?.name || 'Removed container' };
  };
  return {
    ...entry,
    existingContainers,
    itemTargets: entry.itemTargets.map(reconcileTarget),
    proposedTargets: (entry.proposedTargets || entry.result.proposed_containers.map(() => entry.containerId ? { kind: 'existing', containerId: entry.containerId } : { kind: 'loose' })).map(reconcileTarget),
    proposedSkip: entry.proposedSkip || entry.result.proposed_containers.map(() => false),
  };
}

export function selectedReviewCount(entry) {
  if (!entry?.result) return 0;
  return entry.result.items.filter((_, index) => !entry.itemSkip?.[index]).length
    + entry.result.proposed_containers.filter((container, index) => !entry.proposedSkip?.[index]
      || entry.itemTargets?.some((target, itemIndex) => !entry.itemSkip?.[itemIndex] && target.kind === 'proposed' && target.name === container.name)).length;
}

export function buildScanAcceptance(entry) {
  const containers = [];
  const items = [];
  const existing = entry.existingContainers || [];
  const proposed = entry.result.proposed_containers || [];
  const proposedReferences = new Map();
  const selected = entry.result.items.map((item, index) => ({ item, index })).filter(({ index }) => !entry.itemSkip?.[index]);
  const requiredNames = new Set(selected.map(({ index }) => entry.itemTargets?.[index]).filter(target => target?.kind === 'proposed').map(target => normalizeName(target.name)));

  proposed.forEach((container, index) => {
    const name = normalizeName(container.name);
    if (entry.proposedSkip?.[index] && !requiredNames.has(name)) return;
    if (!container.name.trim()) throw new Error('Give each selected container a name before saving.');
    const references = proposedReferences.get(name) || [];
    references.push(containers.length);
    proposedReferences.set(name, references);
    containers.push({ name: container.name.trim(), description: container.description || '', target: entry.proposedTargets?.[index] || { kind: 'loose' } });
  });
  const resolveTarget = (target, parent = false) => {
    const existingKey = parent ? 'parent_id' : 'container_id';
    const proposedKey = parent ? 'proposed_parent_index' : 'proposed_container_index';
    if (target?.kind === 'missing') throw new Error('A container was moved or deleted. Choose a new location for each affected selection.');
    if (target?.kind === 'existing') {
      if (!existing.some(container => container.id === target.containerId)) throw new Error('A container was moved or deleted. Choose a new location for each affected selection.');
      return { [existingKey]: target.containerId };
    }
    if (target?.kind === 'proposed') {
      const references = proposedReferences.get(normalizeName(target.name));
      if (references?.length !== 1) throw new Error('The suggested container is ambiguous. Choose an existing container or the room.');
      return { [proposedKey]: references[0] };
    }
    return { [existingKey]: null };
  };
  selected.forEach(({ item, index }) => {
    if (!item.name?.trim()) throw new Error('Give each selected item a name before saving.');
    if (entry.containerFlags?.[index]) {
      containers.push({ name: item.name.trim(), description: '', target: entry.itemTargets?.[index] });
      return;
    }
    items.push({
      name: item.name.trim(), category: item.category || null, tags: item.tags || [], notes: item.notes || '',
      confidence_score: item.confidence_score, bbox: item.bbox,
      ...resolveTarget(entry.itemTargets?.[index]),
    });
  });
  if (!containers.length && !items.length) throw new Error('Select at least one item or container before saving.');
  return { containers: containers.map(({ target, ...container }) => ({ ...container, ...resolveTarget(target, true) })), items };
}

export function containerLocationLabel(container, allContainers) {
  const names = [];
  const seen = new Set();
  let current = container;
  while (current && !seen.has(current.id)) {
    names.unshift(current.name);
    seen.add(current.id);
    current = allContainers.find(entry => entry.id === current.parent_id);
  }
  return names.join(' / ');
}
