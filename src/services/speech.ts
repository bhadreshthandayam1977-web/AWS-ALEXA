/**
 * Helpers to format text into short, natural, speakable sentences for Alexa+.
 * Constraints: under 300 characters, no markdown, no emojis.
 */

// Matches common emojis, variation selectors, pictographs, and symbols
const EMOJI_REGEX =
  /[\p{Extended_Pictographic}\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu;

/**
 * Removes emojis, markdown syntax, and excessive whitespace.
 */
export function cleanSpokenText(text: string): string {
  if (!text) return '';

  return (
    text
      // Remove emojis
      .replace(EMOJI_REGEX, '')
      // Remove multiline code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Strip markdown links: [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Strip inline code backticks while retaining the text inside
      .replace(/`([^`]+)`/g, '$1')
      .replace(/`+/g, '')
      // Remove markdown header markers (# Header) at line starts, but preserve #42 issue numbers
      .replace(/(?:^|\n)#{1,6}\s+/g, ' ')
      // Remove bold/italic markers (*, _, ~)
      .replace(/[*_~]+/g, '')
      // Replace newlines and carriage returns with a single space
      .replace(/[\r\n]+/g, ' ')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Ensures text is <= maxLength (default 300 chars), cleanly truncating at word boundary if needed.
 */
export function limitLength(text: string, maxLength = 300): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Truncate and leave room for ellipsis
  const truncated = text.slice(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength / 2) {
    return `${truncated.slice(0, lastSpace)}...`;
  }
  return `${truncated}...`;
}

/**
 * Formats a clean, speakable sentence under 300 characters.
 */
export function speakable(text: string, maxLength = 300): string {
  return limitLength(cleanSpokenText(text), maxLength);
}

/**
 * Formats a list of tasks for spoken delivery.
 * Constraints: max 5 items, then "and N more". Under 300 characters.
 */
export function formatTaskListSpeech(
  tasks: Array<{ id: number; title: string; status?: string }>,
  statusFilter = 'open'
): string {
  if (tasks.length === 0) {
    return statusFilter === 'all' ? 'You have no tasks.' : `You have no ${statusFilter} tasks.`;
  }

  const statusLabel = statusFilter === 'all' ? '' : `${statusFilter} `;
  const countLabel =
    tasks.length === 1 ? `1 ${statusLabel}task` : `${tasks.length} ${statusLabel}tasks`;

  const maxDisplay = 5;
  const displayed = tasks.slice(0, maxDisplay);
  const remainingCount = tasks.length - displayed.length;

  const itemsSpoken = displayed.map((t) => `${t.id}, ${cleanSpokenText(t.title)}`).join('; ');

  let result = `You have ${countLabel}: ${itemsSpoken}`;
  if (remainingCount > 0) {
    result += `, and ${remainingCount} more`;
  }
  result += '.';

  return speakable(result, 300);
}
