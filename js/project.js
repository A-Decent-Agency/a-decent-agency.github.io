// Shared by the Node exporter and the visitor's direct-to-GitHub importer.
export const PROJECT_ID = 'PVT_kwDODD7ovc4Bn91h';
const PRIVATE_PORTFOLIOS = new Set(['bean', 'decentmaker', 'jacobsladder26', 'duoduel', 'decentcalendar', 'decentcanvas', 'decentfoot', 'decentfooter', 'thejokerwillplay']);
export const FIELD_NAMES = ['Status', 'Kind', 'Workstream', 'Horizon', 'Role', 'Decision', 'Baseline met', 'Start', 'Target', 'Outcome', 'Dependencies', 'Crossovers'];
const PAGE = `pageInfo { hasNextPage endCursor }`;
const QUERY = `query OfficeProject($id: ID!, $cursor: String) {
  node(id: $id) { ... on ProjectV2 {
    title readme url
    views(first: 100) { nodes { id name layout filter } ${PAGE} }
    items(first: 50, after: $cursor) { ${PAGE} nodes {
      id databaseId type
      content {
        ... on DraftIssue { title body }
        ... on Issue { title body url repository { nameWithOwner isPrivate } }
        ... on PullRequest { title body url repository { nameWithOwner isPrivate } }
      }
      fieldValues(first: 100) { ${PAGE} nodes {
        ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } }
        ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2FieldCommon { name } } }
        ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } }
        ... on ProjectV2ItemFieldMultiSelectValue { options { name } field { ... on ProjectV2FieldCommon { name } } }
      } }
    } }
  } }
}`;

export async function graphql(token, query, variables, fetcher = fetch) {
  const response = await fetcher('https://api.github.com/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}. Check project access and token permissions.`);
  const result = await response.json();
  if (result.errors?.length) throw new Error(`GitHub GraphQL: ${result.errors.map(e => e.message).join('; ')}`);
  return result.data;
}

export function sanitizeItem(item) {
  const content = item.content;
  if (!content?.title) return null; // Deleted / inaccessible content is never reconstructed.
  const fields = Object.fromEntries(FIELD_NAMES.map(name => [name, name === 'Baseline met' ? [] : '']));
  for (const value of item.fieldValues?.nodes || []) {
    const name = value.field?.name;
    if (FIELD_NAMES.includes(name)) fields[name] = value.options?.map(option => option.name) ?? value.text ?? value.date ?? value.name ?? '';
  }
  const portfolioName = content.title.match(/^Portfolio:\s*(.+)$/i)?.[1].trim().toLowerCase();
  const knownPrivate = PRIVATE_PORTFOLIOS.has(portfolioName);
  const repository = content.repository;
  if (repository?.isPrivate) {
    return { id: item.id, title: content.title, private: true,
      fields: Object.fromEntries(['Kind', 'Status', 'Start', 'Target'].map(name => [name, fields[name]])) };
  }
  // A draft Portfolio has no linked repository; fail closed for the private inventory.
  const hideBody = knownPrivate && (!repository || repository.isPrivate !== false);
  return {
    id: item.id, title: content.title,
    type: ({ DRAFT_ISSUE: 'draft', ISSUE: 'issue', PULL_REQUEST: 'PR' })[item.type] || 'draft',
    url: content.url || '', repository: repository?.nameWithOwner || '', fields,
    ...(hideBody ? { bodyRedacted: true } : { body: (content.body || '').slice(0, 4000) }),
  };
}

export async function exportProject(token, id = PROJECT_ID, fetcher = fetch) {
  if (!token) throw new Error('A GitHub token with project read access is required.');
  const items = [];
  let cursor = null, project;
  do {
    const data = await graphql(token, QUERY, { id, cursor }, fetcher);
    const page = data.node;
    if (!page) throw new Error('Project not found or token cannot read it.');
    if (page.views.pageInfo.hasNextPage) throw new Error('More than 100 views: refusing an incomplete export.');
    project = { title: page.title, readme: page.readme || '', url: page.url, views: page.views.nodes };
    for (const item of page.items.nodes) {
      if (item.fieldValues.pageInfo?.hasNextPage) throw new Error('More than 100 fields: refusing an incomplete export.');
      const safe = sanitizeItem(item);
      if (safe) {
        if (safe.type === 'draft' && !safe.url && item.databaseId) safe.url = `${page.url}?pane=issue&itemId=${item.databaseId}`;
        items.push(safe);
      }
    }
    cursor = page.items.pageInfo.hasNextPage ? page.items.pageInfo.endCursor : null;
  } while (cursor);
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), ...project, items };
}

export async function projectIdFromUrl(url, token) {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/^\/(orgs|users)\/([^/]+)\/projects\/(\d+)\/?$/);
  if (parsed.origin !== 'https://github.com' || !match) throw new Error('Use https://github.com/orgs/OWNER/projects/NUMBER (or /users/OWNER/projects/NUMBER).');
  const type = match[1] === 'orgs' ? 'organization' : 'user';
  const data = await graphql(token, `query($owner:String!,$number:Int!){ ${type}(login:$owner){ projectV2(number:$number){ id } } }`, { owner: match[2], number: Number(match[3]) });
  const id = data[type]?.projectV2?.id;
  if (!id) throw new Error('Project not found or not accessible to this token.');
  return id;
}
