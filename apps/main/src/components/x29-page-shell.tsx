import { normalizeX29InternalLinks } from "@/lib/x29-site";
import type { X29PageConfig } from "@/types/x29";

interface X29PageShellProps {
  config: X29PageConfig;
  bodyHtml: string;
  includeQaScript?: boolean;
  qaScript?: string;
}

function renderInlineScript(id: string, body: string) {
  return (
    <script
      key={id}
      id={id}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

export function X29PageShell({
  config,
  bodyHtml,
  includeQaScript = false,
  qaScript = "",
}: X29PageShellProps) {
  const normalizedBodyHtml = normalizeX29InternalLinks(bodyHtml);

  return (
    <>
      {config.inlineStyles.map((style, index) => (
        <style
          key={`x29-style-${config.route}-${index}`}
          dangerouslySetInnerHTML={{ __html: style }}
        />
      ))}
      <div
        id="x29-root"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: normalizedBodyHtml }}
      />
      {config.bodyInlineScripts.map((script, index) =>
        renderInlineScript(`x29-body-inline-${config.route}-${index}`, script),
      )}
      {config.bodyScriptHrefs.map((src) => (
        <script key={src} src={src} />
      ))}
      {includeQaScript && qaScript ? (
        <script
          id={`x29-qa-${config.route}`}
          dangerouslySetInnerHTML={{ __html: qaScript }}
        />
      ) : null}
    </>
  );
}
