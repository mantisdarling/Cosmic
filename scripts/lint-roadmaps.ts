import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { RoadmapSchema } from '../src/lib/security';

const roadmapsDir = join(process.cwd(), 'src/content/roadmaps');

function lintRoadmaps() {
  const files = readdirSync(roadmapsDir).filter(f => f.endsWith('.json'));
  let hasErrors = false;

  console.log(`Linting ${files.length} roadmaps...`);

  for (const file of files) {
    const filePath = join(roadmapsDir, file);
    try {
      const content = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const result = RoadmapSchema.safeParse(data);

      if (!result.success) {
        console.error(`❌ Validation failed for ${file}:`);
        console.error(result.error.issues);
        hasErrors = true;
      } else {
        // Additional custom validation
        const ids = new Set<string>();
        let rootCount = 0;
        let idClash = false;
        
        for (const node of data.nodes) {
          if (ids.has(node.id)) {
            console.error(`❌ Duplicate node ID "${node.id}" found in ${file}`);
            idClash = true;
          }
          ids.add(node.id);
          if (node.type === 'root') rootCount++;
        }

        if (idClash) hasErrors = true;

        if (rootCount !== 1) {
          console.error(`❌ ${file} must have exactly one root node, but found ${rootCount}`);
          hasErrors = true;
        }

        if (!hasErrors) {
           console.log(`✅ ${file} is valid`);
        }
      }
    } catch (e: any) {
      console.error(`❌ Failed to parse ${file}: ${e.message}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error('\n🚨 Linting failed. Please fix the above errors.');
    process.exit(1);
  } else {
    console.log('\n🎉 All roadmaps are valid!');
    process.exit(0);
  }
}

lintRoadmaps();
