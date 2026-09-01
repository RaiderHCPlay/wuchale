export type ProjectKind = 'react' | 'solid-js' | 'svelte' | 'sveltekit' | 'astro' | 'vanilla'
export type ChoosablePackages = 'react' | 'solid-js' | 'svelte' | 'astro'

export interface DetectProjectResult {
    packages: ProjectPackage[]
    packageOverrides: Partial<Record<ProjectKind, ProjectKind>>
    hasViteConfig: boolean
    hasWuchaleConfig: boolean
    hasTailwind: boolean
    isTypeScript: boolean
}

export type ProjectPackage = {
    kind: ProjectKind
    adapter: string
    choosable: boolean
}

export interface AdapterConfig {
    import: { name: string; lib: string }[]
    content: string[]
}

export interface PairedAdapterConfig {
    import: { name: string; lib: string }
    content: string
}

export interface PackageManager {
    name: string
    install: string
}

export type MultiboxPromptOptions = {
    name: string
    adapter: string
    checked: boolean
}

interface ScaffoldContext {
    project: DetectProjectResult
    locales: string[]
}

export interface ScaffoldModule {
    scaffold: (ctx: ScaffoldContext) => Promise<void>
}

export interface FrameworkDefinition {
    package: string
    adapter: string
    kind: ProjectKind
    choosable: boolean
    overrides?: ProjectKind[]
}
