#!/usr/bin/env node
import { createRequire } from 'node:module'
import pkg from '../package.json' with { type: 'json' }
import { writeWuchaleConfig } from './config.js'
import { detectProject } from './detect.js'
import { writeGitignore } from './gitignore.js'
import { detectPackageManager, installDependencies } from './install.js'
import { adapterMultiboxPrompt, confirmPrompt, languagesPrompt } from './prompts.js'
import type { DetectProjectResult, PackageManager, ScaffoldModule } from './types.js'
import { writeViteConfig } from './vite.js'

console.log(`Wuchale-add CLI ${pkg.version}`)

const project: DetectProjectResult | null = detectProject()

if (!project) {
    console.error('No package.json file found. Are you in a project directory?')
    process.exit(1)
}

const locales = await languagesPrompt()

const choosablePackages = project.packages.filter(pkg => pkg.choosable)

const confirmedAdapters = await adapterMultiboxPrompt(choosablePackages)

const selectedAdapters = confirmedAdapters.filter(adapt => adapt.checked)

const adapters = selectedAdapters.map(pkg => pkg.adapter)

const shouldInstall = await confirmPrompt('Install selected dependencies + wuchale package?')

if (shouldInstall) {
    if (adapters.length === 0) {
        console.log('No dependencies to install')
    } else {
        try {
            await installDependencies(adapters)
            console.log('Dependencies installed')
        } catch (error) {
            console.error(`${error} Try manually:`)
            const pkgMgr: PackageManager = detectPackageManager()
            console.error(`\t${pkgMgr.name} ${pkgMgr.install} wuchale ${adapters.join(' ')}`)
        }
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
    const cwd = process.cwd()
    const require = createRequire(`${cwd}/package.json`)

    for (const adapter of selectedAdapters) {
        try {
            const resolvedPath = require.resolve(`${adapter.adapter}/scaffold`)
            const module = (await import(resolvedPath)) as ScaffoldModule
            await module.scaffold(context)
        } catch (err) {
            console.log(`Failed to scaffold for ${adapter.adapter}: ${err}`)
        }
    }
}
