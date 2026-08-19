#!/usr/bin/env node
import { createRequire } from 'node:module'
import pkg from '../package.json' with { type: 'json' }
import { writeWuchaleConfig } from './config.js'
import { detectProject } from './detect.js'
import { writeGitignore } from './gitignore.js'
import { detectPackageManager, installDependencies } from './install.js'
import { adapterMultiboxPrompt, confirmPrompt, languagesPrompt } from './prompts.js'
import type { DetectProjectResult, MultiboxPromptOptions, PackageManager, ScaffoldModule } from './types.js'
import { writeViteConfig } from './vite.js'

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
writeViteConfig(project)

const shouldModifyFiles = await confirmPrompt('Generate and inject example setup files?')

if (shouldModifyFiles) {
    const context = {
        project,
        locales,
    }
    for (const adapter of project.adapters) {
        try {
            const cwd = process.cwd()
            const require = createRequire(`${cwd}/package.json`)
            const resolvedPath = require.resolve(`${adapter}/scaffold`)
            const module = (await import(resolvedPath)) as ScaffoldModule
            await module.scaffold(context)
        } catch (err) {
            console.log(`Failed to scaffold for ${adapter}: ${err}`)
        }
    }
}
