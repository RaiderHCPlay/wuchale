import readline from 'node:readline'
import type { MultiboxPromptOptions, ProjectPackage } from './types.js'

const displayName = new Intl.DisplayNames(['en'], { type: 'language' })

const KEY = {
    ENTER: '\r',
    CTRL_C: '\u0003',
    ARROW_UP: '\u001b[A',
    ARROW_DOWN: '\u001b[B',
    BACKSPACE: '\u007f',
}

const ANSI = {
    HIDE_CURSOR: '\x1b[?25l',
    SHOW_CURSOR: '\x1b[?25h',
}

export function adapterMultiboxPrompt(packages: ProjectPackage[]): Promise<MultiboxPromptOptions[]> {
    return new Promise(resolve => {
        const options = packages.reduce<MultiboxPromptOptions[]>((opts, pkg) => {
            const name = pkg.kind.charAt(0).toUpperCase() + pkg.kind.slice(1)
            const existing = opts.find(option => option.adapter === pkg.adapter)
            if (existing) {
                existing.name += `/${name}`
            } else {
                opts.push({
                    name,
                    adapter: pkg.adapter,
                    checked: true,
                })
            }
            return opts
        }, [])

        if (options.length === 0) {
            resolve([])
            return
        }

        let rendered = false
        let cursor = 0

        const render = () => {
            if (rendered) {
                const lines = options.length + 1
                readline.moveCursor(process.stdout, 0, -lines)
                readline.clearScreenDown(process.stdout)
            } else {
                rendered = true
            }

            process.stdout.write(ANSI.HIDE_CURSOR)

            process.stdout.write('Detected adapters to install (Space = check/uncheck, Enter = accept)\n')
            options.forEach((option, index) => {
                const pointer = index === cursor ? '<' : ''
                const checked = option.checked ? '[x]' : '[]'

                process.stdout.write(`${checked} ${option.name} ${pointer}\n`)
            })
        }

        const cleanup = () => {
            process.stdin.setRawMode(false)
            process.stdin.pause()
            process.stdin.off('data', onData)
            process.stdout.write(ANSI.SHOW_CURSOR)
        }

        const onData = (key: string) => {
            switch (key) {
                case KEY.CTRL_C:
                    cleanup()
                    process.stdout.write('Operation cancelled\n')
                    return process.exit(0)

                case KEY.ENTER:
                    cleanup()
                    resolve(options)
                    return

                case ' ':
                    options[cursor]!.checked = !options[cursor]?.checked
                    break
                case KEY.ARROW_UP:
                    cursor = (cursor - 1 + options.length) % options.length
                    break

                case KEY.ARROW_DOWN:
                    cursor = (cursor + 1) % options.length
                    break
            }
            render()
        }

        process.stdin.setRawMode(true)
        process.stdin.resume()
        process.stdin.setEncoding('utf8')
        render()

        process.stdin.on('data', onData)
    })
}

export function languagesPrompt(): Promise<string[]> {
    return new Promise(resolve => {
        let input = ''
        let rendered = false

        const render = (error = '') => {
            if (rendered) {
                const cursorLines = 1
                readline.moveCursor(process.stdout, 0, -cursorLines)
                readline.cursorTo(process.stdout, 0)

                readline.clearScreenDown(process.stdout)
            }

            rendered = true

            process.stdout.write('Which languages do you want to support? (e.g. en,zh-TW)\n')

            process.stdout.write(`> ${input}\n`)
            if (error) process.stdout.write(`${error}`)

            readline.cursorTo(process.stdout, input.length + 2)

            readline.moveCursor(process.stdout, 0, -1)
        }

        const cleanup = () => {
            process.stdin.setRawMode(false)
            process.stdin.pause()
            process.stdin.off('data', onData)
        }

        const onData = (key: string) => {
            switch (key) {
                case KEY.CTRL_C:
                    cleanup()
                    process.stdout.write('\nOperation cancelled\n')
                    return process.exit(0)

                case KEY.ENTER: {
                    const { invalidTags, validTags } = parseLanguageInput(input)

                    if (invalidTags.length === 0) {
                        cleanup()
                        process.stdout.write('\n')
                        resolve(validTags.length ? validTags : ['en'])
                        return
                    }

                    render(checkInvalidTags(input) ?? undefined)
                    return
                }
                case KEY.BACKSPACE:
                    input = input.slice(0, -1)
                    break
                default:
                    if (key.startsWith('\u001b')) break
                    input += key
            }

            render()
        }

        process.stdin.setRawMode(true)
        process.stdin.resume()
        process.stdin.setEncoding('utf8')

        render()

        process.stdin.on('data', onData)
    })
}

export function confirmPrompt(text: string): Promise<boolean> {
    return new Promise(resolve => {
        let input = ''
        let rendered = false

        const render = (error = '') => {
            if (rendered) {
                readline.cursorTo(process.stdout, 0)
                readline.moveCursor(process.stdout, 0, 0)
                readline.clearScreenDown(process.stdout)
            }
            rendered = true

            process.stdout.write(`${text}(Y/N): ${input}\n`)

            if (error) process.stdout.write(`${error}`)

            readline.moveCursor(process.stdout, 0, -1)
            readline.cursorTo(process.stdout, text.length + input.length + 7)
        }

        const cleanup = () => {
            process.stdin.setRawMode(false)
            process.stdin.pause()
            process.stdin.off('data', onData)
        }

        const onData = (key: string) => {
            switch (key) {
                case KEY.CTRL_C:
                    cleanup()
                    process.stdout.write('\nOperation cancelled\n')
                    return process.exit(0)
                case KEY.ENTER: {
                    const answer = input.toLowerCase()

                    if (answer !== 'y' && answer !== 'n') {
                        render('Not valid input')
                        return
                    }

                    resolve(answer === 'y')
                    process.stdout.write('\n')
                    cleanup()
                    return
                }

                case KEY.BACKSPACE:
                    input = input.slice(0, -1)
                    break

                default:
                    if (key.startsWith('\u001b')) break
                    input += key
            }
            render()
        }

        process.stdin.setRawMode(true)
        process.stdin.resume()
        process.stdin.setEncoding('utf8')

        render()

        process.stdin.on('data', onData)
    })
}

function checkInvalidTags(data: string): string | undefined {
    const { invalidTags } = parseLanguageInput(data)

    if (invalidTags.length > 0) {
        if (invalidTags.length === 1) {
            return `Your input "${invalidTags[0]}" is not a valid BCP language tag`
        } else {
            const list = new Intl.ListFormat('en', {
                style: 'long',
                type: 'conjunction',
            })
            return `Your inputs ${list.format(invalidTags.map(x => `"${x}"`))} are not a valid BCP language tags`
        }
    }
}

function parseLanguageInput(input: string) {
    const potentialTags = input.replace(/[,\s]/g, ' ').split(' ').filter(Boolean)

    const validTags: string[] = []
    const invalidTags: string[] = []

    for (const tag of potentialTags) {
        if (validLanguageTag(tag)) validTags.push(tag)
        else invalidTags.push(tag)
    }

    return {
        invalidTags,
        validTags,
    }
}

function validLanguageTag(tag: string) {
    try {
        const name = displayName.of(tag)
        return name !== undefined && name !== tag
    } catch {
        return false
    }
}
