export interface IniData {
  [section: string]: { [key: string]: string };
}

export function parseIni(content: string): IniData {
  const data: IniData = {};
  let currentSection = "";
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) {
      continue;
    }
    const sectionMatch = line.match(/^\[(.+?)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!data[currentSection]) {
        data[currentSection] = {};
      }
      continue;
    }
    const kvMatch = rawLine.match(/^\s*([^=]+?)\s*=\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();
      if (!data[currentSection]) {
        data[currentSection] = {};
      }
      data[currentSection][key] = value;
    }
  }
  return data;
}

/**
 * Updates or inserts keys in a section while preserving unrelated content and comments.
 */
export function updateIniSection(
  content: string,
  section: string,
  updates: Record<string, string>,
): string {
  const lines = content.split(/\r?\n/);
  const sectionHeader = `[${section}]`;
  let inSection = false;
  let sectionStart = -1;
  let sectionEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("[")) {
      const hdr = line.trim();
      if (!inSection && hdr === sectionHeader) {
        inSection = true;
        sectionStart = i;
        continue;
      }
      if (inSection && hdr !== sectionHeader) {
        sectionEnd = i;
        break;
      }
    }
  }

  // If section doesn't exist, append it
  if (!inSection) {
    const newSectionLines = [
      "",
      sectionHeader,
      ...Object.entries(updates).map(([k, v]) => `${k} = ${v}`),
    ];
    return (
      content +
      (content.endsWith("\n") ? "" : "\n") +
      newSectionLines.join("\n") +
      "\n"
    );
  }

  // Build a map of which keys were updated
  const updatedKeys = new Set<string>();
  const keyRegexes: Array<[RegExp, string]> = Object.keys(updates).map((k) => [
    new RegExp(`^\\s*${escapeRegex(k)}\\s*=.*$`),
    k,
  ]);

  for (let i = sectionStart + 1; i < sectionEnd; i++) {
    const line = lines[i];
    for (const [re, key] of keyRegexes) {
      if (re.test(line)) {
        lines[i] = `${key} = ${updates[key]}`;
        updatedKeys.add(key);
        break;
      }
    }
  }

  // Insert any missing keys just before sectionEnd
  const toInsert: string[] = [];
  for (const [k, v] of Object.entries(updates)) {
    if (!updatedKeys.has(k)) {
      toInsert.push(`${k} = ${v}`);
    }
  }
  if (toInsert.length > 0) {
    lines.splice(sectionEnd, 0, ...toInsert);
  }

  return lines.join("\n");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
