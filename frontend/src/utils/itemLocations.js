import { containerLocationLabel } from './scanReview.js';

export function itemLocationLabels(items, containers) {
  return [...new Set(items.map(item => {
    if (item.container_id == null) return 'Loose in room';
    const container = containers.find(entry => entry.id === item.container_id);
    return container ? containerLocationLabel(container, containers) : 'Location unavailable';
  }))];
}
