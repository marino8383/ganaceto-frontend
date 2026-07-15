// Genera src/app/build-info.ts a build-time (data/ora + commit git).
// Richiamato dagli script npm "build" e "start" (vedi package.json).
// Il file generato è in .gitignore: viene ricreato a ogni build.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function shortCommit() {
  // Su Vercel il commit è nell'ambiente; in locale lo leggo da git.
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

const info = { time: new Date().toISOString(), commit: shortCommit() };

const out = path.join(__dirname, '..', 'src', 'app', 'build-info.ts');
const content = `// GENERATO AUTOMATICAMENTE da scripts/gen-build-info.cjs — non modificare a mano.
export const BUILD_INFO = {
  time: '${info.time}',
  commit: '${info.commit}',
} as const;
`;

fs.writeFileSync(out, content);
console.log('build-info generato:', info.time, info.commit);
