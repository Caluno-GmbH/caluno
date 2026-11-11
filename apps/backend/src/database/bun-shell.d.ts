// Minimal ambient typing for the Bun shell API used by migrate.mts.
//
// Deliberately not installing `@types/bun`: it ships its own `declare module
// 'bun:test'` with a strict, non-Jest-compatible `expect()` signature, which
// would override the loose override in `test/bun-test.d.ts` and reintroduce
// type errors across the existing (Jest-style) spec files. See AGENTS.md.
declare module 'bun' {
  interface ShellPromise
    extends Promise<{
      exitCode: number | null;
      stdout: Buffer;
      stderr: Buffer;
    }> {
    cwd(dir: string): ShellPromise;
    quiet(isQuiet?: boolean): ShellPromise;
    nothrow(): ShellPromise;
  }

  export const $: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => ShellPromise;
}

// Bun's runtime-only extension to `import.meta`.
interface ImportMeta {
  readonly dir: string;
}
