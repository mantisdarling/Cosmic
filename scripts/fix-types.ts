import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const dir = join(process.cwd(), 'src/content/roadmaps');
const files = readdirSync(dir).filter(f => f.endsWith('.json'));

files.forEach(file => {
  const p = join(dir, file);
  let content = readFileSync(p, 'utf8');
  content = content.replace(/"type"\s*:\s*"subtopic"/g, '"type": "topic"');
  writeFileSync(p, content);
});

console.log('Fixed invalid node types!');
