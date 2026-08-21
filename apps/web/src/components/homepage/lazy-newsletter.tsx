"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@thread/ui";

const NewsletterForm = dynamic(() => import("./newsletter-form"), {
  loading: () => <Skeleton className="mt-7 h-28 bg-paper/10" />,
  ssr: false,
});

export function LazyNewsletter() {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={container}>
      {visible ? <NewsletterForm /> : <Skeleton className="mt-7 h-28 bg-paper/10" />}
    </div>
  );
}
