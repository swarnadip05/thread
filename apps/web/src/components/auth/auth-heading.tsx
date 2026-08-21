export function AuthHeading({ description, title }: { description: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">THREAD account</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}
