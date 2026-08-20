import { existsSync, readFileSync } from 'node:fs'
import type { DetectProjectResult, ProjectKind } from './types.js'

const metaFrameworks = [
    {
        package: '@sveltejs/kit',
        adapter: '@wuchale/svelte',
        kind: 'sveltekit',
    },
    {
        package: 'astro',
        adapter: '@wuchale/astro',
        kind: 'astro',
    },
] satisfies { package: string; adapter: string; kind: ProjectKind }[]

const frameworks = [
    {
        package: 'svelte',
        adapter: '@wuchale/svelte',
        kind: 'svelte',
    },
    {
        package: 'react',
        adapter: '@wuchale/jsx',
        kind: 'react',
    },
    {
        package: 'solid-js',
        adapter: '@wuchale/jsx',
        kind: 'solid-js',
    },
] satisfies { package: string; adapter: string; kind: ProjectKind }[]

function readPackageJson() {
    try {
        const data = readFileSync('./package.json', 'utf-8')
        return JSON.parse(data)
    } catch {
        return null
    }
}

export function detectProject() {
    const result: DetectProjectResult = {
        projectKind: 'vanilla',
        detectedPackages: [],
        adapters: [],
        packageKinds: [],
        hasViteConfig: false,
        hasWuchaleConfig: false,
        isTypeScript: false,
    }

    const pkg = readPackageJson()
    if (!pkg) return null

    const detectedPackages: string[] = []

    const deps: string[] = Object.keys(pkg.dependencies ?? {})
    const devDeps = Object.keys(pkg.devDependencies ?? {})

    for (const fm of metaFrameworks) {
        if (deps.includes(fm.package) || devDeps.includes(fm.package)) {
            result.projectKind = fm.kind
            detectedPackages.push(fm.package)
            result.adapters.push(fm.adapter)
            if (fm.kind !== 'sveltekit') {
                result.packageKinds.push(fm.kind)
            }
            break
        }
    }

    for (const fm of frameworks) {
        if (deps.includes(fm.package) || devDeps.includes(fm.package)) {
            detectedPackages.push(fm.package)
            result.packageKinds.push(fm.kind)
            if (!result.adapters.includes(fm.adapter)) {
                result.adapters.push(fm.adapter)
            }
            if (result.projectKind === 'vanilla') {
                result.projectKind = fm.kind
            }
        }
    }

    if (result.packageKinds.length === 0) result.packageKinds.push('vanilla')

    result.detectedPackages = detectedPackages

    if (existsSync('vite.config.ts') || existsSync('vite.config.js')) {
        result.hasViteConfig = true
    }

    if (existsSync('wuchale.config.ts') || existsSync('wuchale.config.js')) {
        result.hasWuchaleConfig = true
    }

    if (deps.includes('typescript') || devDeps.includes('typescript')) {
        result.isTypeScript = true
    }

    return result
}
