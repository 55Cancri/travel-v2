// Which visual (soft-wrapped) line a textarea's caret sits on, measured by
// re-flowing the text in a hidden mirror with the same metrics. Plan rows
// never hold hard newlines (Enter spawns a new row), so every line here is a
// wrap. Drives arrow-key row navigation: the caret walks freely inside a
// wrapped row and only jumps rows from its first or last line.
export const caretLine = (el: HTMLTextAreaElement) => {
  const style = getComputedStyle(el);
  const mirror = document.createElement("div");
  mirror.style.position = "fixed";
  mirror.style.left = "-9999px";
  mirror.style.visibility = "hidden";
  mirror.style.boxSizing = "content-box";
  mirror.style.width = `${
    el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  }px`;
  mirror.style.font = style.font;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.whiteSpace = style.whiteSpace;
  mirror.style.overflowWrap = style.overflowWrap;
  mirror.style.wordBreak = style.wordBreak;
  const caret = el.selectionStart ?? 0;
  const marker = document.createElement("span");
  marker.textContent = "​";
  mirror.append(el.value.slice(0, caret), marker, el.value.slice(caret) || "​");
  document.body.appendChild(mirror);
  const lineHeight = parseFloat(style.lineHeight);
  const line = Math.round(marker.offsetTop / lineHeight);
  const lineCount = Math.max(1, Math.round(mirror.offsetHeight / lineHeight));
  mirror.remove();
  return { line, lineCount };
};
