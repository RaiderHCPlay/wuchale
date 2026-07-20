export type ProjectKind = 'react' | 'solid-js' | 'svelte' | 'sveltekit' | 'astro' | 'vanilla'

export interface DetectProjectResult {
    projectKind: ProjectKind
    detectedPackages: string[]
    packageKinds: ProjectKind[]
    hasViteConfig: boolean
    hasWuchaleConfig: boolean
    isTypeScript: boolean
}

export interface AdapterConfig {
    import: { name: string; lib: string }[]
    content: string[]
}

export interface PairedAdapterConfig {
    import: { name: string; lib: string }
    content: string
}
