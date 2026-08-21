export function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 10,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ["Very weak", "Weak", "Fair", "Strong", "Strong"];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="grid grid-cols-4 gap-1" aria-hidden="true">
        {checks.map((passed, index) => (
          <span
            className={`h-1 rounded-full ${index < score && passed ? "bg-success" : "bg-ink/10"}`}
            key={index}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">Password strength: {labels[score]}</p>
    </div>
  );
}
