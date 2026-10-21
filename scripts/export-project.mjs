import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { exportProject } from '../js/project.js';

const destination = new URL('../data/project.json', import.meta.url);
try {
  const project = await exportProject(process.env.GITHUB_TOKEN);
  let previous;
  try { previous = JSON.parse(await readFile(destination, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const comparable = ({ exportedAt, ...rest }) => JSON.stringify(rest);
  if (previous && comparable(previous) === comparable(project)) {
    console.log(`No project changes (${project.items.length} items); preserving last synced timestamp.`);
  } else {
    await mkdir(new URL('../data/', import.meta.url), { recursive: true });
    await writeFile(destination, `${JSON.stringify(project, null, 2)}\n`);
    console.log(`Exported ${project.items.length} privacy-filtered items to data/project.json.`);
  }
} catch (error) {
  console.error(`Project sync failed: ${error.message}`);
  process.exitCode = 1;
}
