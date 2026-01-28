import * as fs from 'fs';
import * as path from 'path';

const appDir = path.join(process.cwd(), 'app');

function fixFile(filePath: string): boolean {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  
  // Fix session.user.companyId -> session.companyId
  content = content.replace(/session\.user\.companyId/g, 'session.companyId');
  
  // Fix session.user.id -> session.id
  content = content.replace(/session\.user\.id/g, 'session.id');
  
  // Fix session.userId -> session.id
  content = content.replace(/session\.userId/g, 'session.id');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Fixed: ${filePath}`);
    return true;
  }
  return false;
}

function walkDir(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

async function main() {
  console.log('🔧 Fixing session.* references...\n');
  
  const files = walkDir(appDir);
  let fixedCount = 0;
  
  for (const file of files) {
    if (fixFile(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\n✅ Fixed ${fixedCount} files`);
}

main().catch(console.error);
