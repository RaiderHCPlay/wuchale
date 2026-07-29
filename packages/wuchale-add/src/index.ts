#!/usr/bin/env node
import pkg from '../package.json' with { type: 'json' }
import { writeWuchaleConfig } from './config.js'
import { detectProject } from './detect.js'
import { writeGitignore } from './gitignore.js'
import { detectPackageManager, installDependencies } from './install.js'
import { adapterMultiboxPrompt, confirmPrompt, languagesPrompt } from './prompts.js'
import type { DetectProjectResult, MultiboxPromptOptions, PackageManager } from './types.js'

console.log(`Wuchale-add CLI ${pkg.version}`)

const project: DetectProjectResult | null = detectProject()

if (!project) {
    console.error('No package.json file found. Are you in a project directory?')
    process.exit(1)
}

const locales = await languagesPrompt()

const confirmedAdapters: MultiboxPromptOptions[] = await adapterMultiboxPrompt(project.packageKinds)
const adapters = []
for (const adapter of confirmedAdapters) {
    adapters.push(adapter.name)
}

const shouldInstall = await confirmPrompt('Install selected dependencies?')

if (shouldInstall) {
    try {
        await installDependencies(adapters)
        console.log('Dependencies installed')
    } catch (error) {
        console.error(`${error} Try manually:`)
        const pkgMgr: PackageManager = detectPackageManager()
        console.error(`\t${pkgMgr.name} ${pkgMgr.install} wuchale ${adapters.join(' ')}`)
    }
}

writeGitignore()
writeWuchaleConfig(project, locales)
// writeViteConfig() future vite config injection function

const shouldModifyFiles = await confirmPrompt('Generate and inject example setup files?')

if (shouldModifyFiles) {
    // calling scaffolding module here
}
