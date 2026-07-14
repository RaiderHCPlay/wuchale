export type ProjectKind = 'react' | 'solid-js' | 'svelte' | 'sveltekit' | 'astro' | 'vanilla'

export interface DetectProjectResult {
    projectKind: ProjectKind
    detectedPackages: string[]
    hasViteConfig: boolean
    hasWuchaleConfig: boolean
    isTypeScript: boolean
}
