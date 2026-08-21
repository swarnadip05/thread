"use client";

import { Button, ErrorState } from "@thread/ui";

export default function AdminError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <ErrorState
      action={<Button onClick={reset}>Try again</Button>}
      description="The admin workspace could not load safely. No changes were applied."
      title="Workspace unavailable"
    />
  );
}
