import { MessageCircle } from "lucide-react";

export function WhatsAppLink({ number }: { number: string }) {
  return (
    <a
      aria-label="Contact THREAD on WhatsApp"
      className="focus-ring fixed bottom-20 right-4 z-raised grid size-12 place-items-center rounded-full bg-success text-paper shadow-raised transition-transform hover:-translate-y-0.5 motion-reduce:transition-none lg:bottom-6 lg:right-6 lg:size-14"
      href={`https://wa.me/${number}`}
      rel="noreferrer"
      target="_blank"
    >
      <MessageCircle aria-hidden="true" className="size-6" />
    </a>
  );
}
