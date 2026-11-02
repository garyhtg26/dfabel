"use client";

import { useEffect } from "react";
import "./scroll-reveal.css";

/** Animate marked sections once, without hiding server-rendered content. */
export default function ScrollReveal() {
  useEffect(() => {
    if (
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;

    const pending = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.dataset.revealState = "visible";
          pending.delete(element);
          observer.unobserve(element);
        }
      },
      { threshold: 0, rootMargin: "0px 0px -40px 0px" },
    );

    const prepare = (element: HTMLElement) => {
      if (element.dataset.revealState) return;
      element.dataset.revealState = "pending";
      pending.add(element);
      observer.observe(element);
    };
    const findSections = (root: ParentNode) => {
      if (root instanceof HTMLElement && root.matches("[data-scroll-reveal]"))
        prepare(root);
      root
        .querySelectorAll<HTMLElement>("[data-scroll-reveal]")
        .forEach(prepare);
    };
    findSections(document);

    // Views in the customer app can change without navigating to a new page.
    const mutations = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (node instanceof HTMLElement) findSections(node);
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      observer.disconnect();
      pending.forEach((element) => delete element.dataset.revealState);
    };
  }, []);

  return null;
}
