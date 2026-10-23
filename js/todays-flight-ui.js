import { todaysFlight } from './todays-flight.js';

/** Mount in a dedicated container; callbacks never write to the project. */
export function mount({ container, items = [], onDestination, onItem, maxPerGroup = 3 }) {
  const doc = container.ownerDocument;
  const root = doc.createElement('section');
  root.className = 'todays-flight';
  root.setAttribute('aria-label', "Today's flight");
  container.append(root);
  const element = (tag, content, parent) => {
    const node = doc.createElement(tag);
    node.textContent = content;
    parent.append(node);
    return node;
  };
  function update(nextItems) {
    const route = todaysFlight(nextItems, { maxPerGroup });
    root.replaceChildren();
    element('h2', "Today's flight", root);
    element('p', 'A bounded, read-only route from the public snapshot—not a schedule, priority ranking, or live GitHub review check.', root);
    for (const group of route.groups) {
      const section = element('section', '', root);
      element('h3', `${group.title} (${group.total})`, section);
      if (!group.total) element('p', group.empty, section);
      else {
        const list = element('ol', '', section);
        for (const stop of group.stops) {
          const row = element('li', '', list);
          element('strong', stop.title, row);
          element('p', stop.why, row);
          if (stop.dependency.state === 'unknown') element('p', `Dependencies unknown: ${stop.dependency.reason}`, row);
          if (onDestination) {
            const button = element('button', 'Go to site', row);
            button.type = 'button';
            button.setAttribute('aria-label', `Go to site for ${stop.title}`);
            button.addEventListener('click', () => onDestination(stop.destinationId));
          }
          if (onItem) {
            const button = element('button', 'Open source card', row);
            button.type = 'button';
            button.setAttribute('aria-label', `Open source card: ${stop.title}`);
            button.addEventListener('click', () => onItem(stop.item));
          }
        }
        if (group.omitted) element('p', `${group.omitted} more source-supported stops not shown. Open the full list to explore.`, section);
      }
    }
    element('p', `${route.unknownDependencies} Todo tasks have unknown dependencies; ${route.waitingDependencies} have explicit prerequisites not marked Done. Neither is suggested as unblocked.`, root);
    return route;
  }
  update(items);
  return { update, destroy: () => root.remove() };
}
