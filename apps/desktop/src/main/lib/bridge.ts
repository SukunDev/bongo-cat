import { ChildProcess, spawn } from 'child_process'
import { app, BrowserWindow } from 'electron'
import path from 'path'
import readline from 'readline'

let bridgeProcess: ChildProcess | null = null

function getBridgePath(): string {
  return path.resolve(app.getAppPath(), '..', 'bridge', 'main.py')
}

export function startBridge(mainWindow: BrowserWindow): void {
  const bridgePath = getBridgePath()

  bridgeProcess = spawn('py', [bridgePath], {
    stdio: ['pipe', 'pipe', 'pipe']
  })

  if (!bridgeProcess.stdout || !bridgeProcess.stderr) return

  const rl = readline.createInterface({ input: bridgeProcess.stdout })
  rl.on('line', (line: string) => {
    try {
      const event = JSON.parse(line)
      mainWindow.webContents.send('bridge-event', event)
    } catch {
      // ignore non-JSON lines
    }
  })

  bridgeProcess.stderr.on('data', () => {
    // bridge stderr ignored — debug output only
  })

  bridgeProcess.on('exit', (code: number | null) => {
    console.log(`[bridge] exited with code ${code}`)
    bridgeProcess = null
    mainWindow.webContents.send('bridge-event', {
      type: 'status',
      connection: 'bridge',
      state: 'disconnected'
    })
  })
}

export function sendToBridge(command: object): void {
  if (bridgeProcess?.stdin?.writable) {
    bridgeProcess.stdin.write(JSON.stringify(command) + '\n')
  }
}

export function stopBridge(): void {
  if (bridgeProcess) {
    sendToBridge({ type: 'quit' })
    setTimeout(() => {
      if (bridgeProcess) {
        bridgeProcess.kill()
        bridgeProcess = null
      }
    }, 2000)
  }
}
