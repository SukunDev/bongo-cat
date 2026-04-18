// Clears ELECTRON_RUN_AS_NODE before spawning electron-vite.
// VSCode sets this env var which forces Electron to run as plain Node.js.
delete process.env.ELECTRON_RUN_AS_NODE

const { execSync } = require('child_process')
const args = process.argv.slice(2).join(' ')

try {
  execSync(`electron-vite --config ./vite.config.ts ${args}`, {
    stdio: 'inherit',
    cwd: __dirname + '/..'
  })
} catch {
  process.exit(1)
}
