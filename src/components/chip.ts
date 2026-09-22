/** Pill toggle classes: solid when active, outlined when not. */
export function chipClass(active: boolean): string {
  return `rounded-full px-3 py-1.5 font-mono text-[0.66rem] uppercase tracking-wider transition ${
    active ? "bg-ink text-card" : "border border-line text-muted hover:border-ink hover:text-ink"
  }`;
}
