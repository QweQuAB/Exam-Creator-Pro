import katex from "katex";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  text: string;
  className?: string;
  block?: boolean;
}

function renderWithMath(text: string): string {
  if (!text) return "";

  let result = "";
  let i = 0;

  while (i < text.length) {
    // Display math: $$...$$
    if (text.startsWith("$$", i)) {
      const end = text.indexOf("$$", i + 2);
      if (end !== -1) {
        const latex = text.slice(i + 2, end);
        try {
          result += katex.renderToString(latex, { displayMode: true, throwOnError: false });
        } catch {
          result += `<span class="text-destructive">$$${latex}$$</span>`;
        }
        i = end + 2;
        continue;
      }
    }

    // Display math: \[...\]
    if (text.startsWith("\\[", i)) {
      const end = text.indexOf("\\]", i + 2);
      if (end !== -1) {
        const latex = text.slice(i + 2, end);
        try {
          result += katex.renderToString(latex, { displayMode: true, throwOnError: false });
        } catch {
          result += `<span class="text-destructive">\\[${latex}\\]</span>`;
        }
        i = end + 2;
        continue;
      }
    }

    // Inline math: $...$
    if (text[i] === "$" && !text.startsWith("$$", i)) {
      const end = text.indexOf("$", i + 1);
      if (end !== -1 && !text.startsWith("$$", end)) {
        const latex = text.slice(i + 1, end);
        try {
          result += katex.renderToString(latex, { displayMode: false, throwOnError: false });
        } catch {
          result += `<span class="text-destructive">$${latex}$</span>`;
        }
        i = end + 1;
        continue;
      }
    }

    // Inline math: \(...\)
    if (text.startsWith("\\(", i)) {
      const end = text.indexOf("\\)", i + 2);
      if (end !== -1) {
        const latex = text.slice(i + 2, end);
        try {
          result += katex.renderToString(latex, { displayMode: false, throwOnError: false });
        } catch {
          result += `<span class="text-destructive">\\(${latex}\\)</span>`;
        }
        i = end + 2;
        continue;
      }
    }

    // Escape HTML for plain text
    const ch = text[i]!;
    if (ch === "&") result += "&amp;";
    else if (ch === "<") result += "&lt;";
    else if (ch === ">") result += "&gt;";
    else if (ch === "\n") result += "<br/>";
    else result += ch;
    i++;
  }

  return result;
}

export function MathRenderer({ text, className = "", block = false }: MathRendererProps) {
  const html = renderWithMath(text ?? "");
  const Tag = block ? "div" : "span";
  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
