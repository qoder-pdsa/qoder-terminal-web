export function PlaceholderPanel({ title }: { title: string }) {
  return (
    <div className="muted" data-testid="placeholder-panel">
      {title} — NOT IMPLEMENTED (see backlog)
    </div>
  );
}
