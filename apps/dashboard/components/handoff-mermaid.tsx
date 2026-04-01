"use client";

import { useEffect, useId, useState } from "react";

import { getErrorMessage } from "@/lib/api-client";

type HandoffMermaidProps = {
  definition: string;
  caption: string;
};

export function HandoffMermaid({ definition, caption }: HandoffMermaidProps) {
  const diagramId = useId().replace(/:/gu, "");
  const [svgMarkup, setSvgMarkup] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        const mermaid = (await import("mermaid")).default;

        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "loose",
          themeVariables: {
            background: "#091423",
            primaryColor: "#10233a",
            primaryTextColor: "#eff6ff",
            primaryBorderColor: "#3d5c80",
            lineColor: "#36506f",
            tertiaryColor: "#091423",
            fontFamily: "SF Pro Display, Segoe UI, sans-serif"
          }
        });

        const { svg } = await mermaid.render(`handoff-${diagramId}`, definition);

        if (cancelled) {
          return;
        }

        setSvgMarkup(svg);
        setError(null);
      } catch (renderError) {
        if (cancelled) {
          return;
        }

        setSvgMarkup("");
        setError(getErrorMessage(renderError));
      }
    }

    void renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [definition, diagramId]);

  return (
    <div className="diagram-shell">
      {error ? (
        <div className="notice-banner">
          Mermaid refused to cooperate: {error}
        </div>
      ) : (
        <div
          className="diagram"
          aria-label="Agent handoff diagram"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      )}
      <p className="diagram-caption">{caption}</p>
    </div>
  );
}
