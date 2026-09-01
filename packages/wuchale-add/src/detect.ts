import { existsSync, readFileSync } from 'node:fs'
import type { DetectProjectResult, FrameworkDefinition } from './types.js'

const frameworks = [
    {
        package: '@sveltejs/kit',
        adapter: '@wuchale/svelte',
        kind: 'sveltekit',
        choosable: false,
        overrides: ['svelte'],
    },
    {
        package: 'astro',
        adapter: '@wuchale/astro',
        choosable: true,
        kind: 'astro',
    },

    {
        package: 'svelte',
        adapter: '@wuchale/svelte',
        choosable: true,
        kind: 'svelte',
    },
    {
        package: 'react',
        adapter: '@wuchale/jsx',
        choosable: true,
        kind: 'react',
    },
    {
        package: 'solid-js',
        adapter: '@wuchale/jsx',
        choosable: true,
        kind: 'solid-js',
    },
] satisfies FrameworkDefinition[]

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
        packages: [],
        packageOverrides: {},
        hasViteConfig: false,
        hasTailwind: false,
        hasWuchaleConfig: false,
        isTypeScript: false,
    }

    const pkg = readPackageJson()
    if (!pkg) return null

    const deps: string[] = Object.keys(pkg.dependencies ?? {})
    const devDeps = Object.keys(pkg.devDependencies ?? {})

    for (const fm of frameworks) {
        if (deps.includes(fm.package) || devDeps.includes(fm.package)) {
            result.packages.push({
                kind: fm.kind,
                choosable: fm.choosable,
                adapter: fm.adapter,
            })

            if (fm.overrides) {
                for (const override of fm.overrides) {
                    result.packageOverrides[override] = fm.kind
                }
            }
        }
    }

    if (existsSync('vite.config.ts') || existsSync('vite.config.js')) {
        result.hasViteConfig = true
    }

    if (existsSync('wuchale.config.ts') || existsSync('wuchale.config.js')) {
        result.hasWuchaleConfig = true
    }

    if (deps.includes('typescript') || devDeps.includes('typescript') || existsSync('tsconfig.json')) {
        result.isTypeScript = true
    }

    if (deps.includes('tailwindcss') || devDeps.includes('tailwindcss')) {
        result.hasTailwind = true
    }

    return result
}
