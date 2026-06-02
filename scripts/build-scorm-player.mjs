// Sync the production build (dist/) into backend/app/scorm_player/, the bundle
// the backend zips into SCORM packages. Run after `vite build`.
//   npm run build:scorm
import { rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';

const SRC = 'dist';
const DEST = 'backend/app/scorm_player';

if (!existsSync(SRC)) {
  console.error(`[build-scorm-player] "${SRC}" not found — run the build first.`);
  process.exit(1);
}
rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true });
console.log(`[build-scorm-player] synced ${SRC} -> ${DEST}`);
