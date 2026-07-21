import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { DetectProjectResult, PackageManager } from './types.js'

export function installDependencies(project: DetectProjectResult): Promise<void> {
    return new Promise((resolve, reject) => {
        const pkgManager: PackageManager = detectPackageManager()
        const proc = spawn(pkgManager.name, [pkgManager.install, 'wuchale', ...project.adapters], {
            stdio: 'inherit',
        })

        proc.on('error', reject)

        proc.on('close', code => {
            if (code === 0) resolve()
            else reject(new Error('Failed to install dependencies'))
        })
    })
}

function detectPackageManager() {
    if (existsSync('./pnpm-lock.yaml')) return { name: 'pnpm', install: 'add' }
    else if (existsSync('./yarn.lock')) return { name: 'yarn', install: 'add' }
    else if (existsSync('./bun.lock') || existsSync('./bun.lockb')) return { name: 'bun', install: 'add' }
    return { name: 'npm', install: 'install' }
}
