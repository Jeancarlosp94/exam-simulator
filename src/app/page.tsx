export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="flex flex-col items-center gap-6 max-w-xl">
        <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs uppercase tracking-widest text-teal-300">
          Sprint 0 · Fundación
        </span>
        <h1 className="text-5xl font-semibold tracking-tight">Quizen</h1>
        <p className="text-lg text-neutral-400">
          Sube tu PDF. Estudia con calma.
        </p>
        <p className="text-sm text-neutral-500">
          Next.js {process.env.npm_package_dependencies_next ?? "16"} · React 19
          · Tailwind v4 · TypeScript estricto
        </p>
      </div>
    </main>
  );
}
