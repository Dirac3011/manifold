import { prisma } from "../prisma";
import { parseBibtex } from "../latex/citations";
import { appendBibEntries, inferBibFormat, normalizeBibEntry } from "./format";

export async function upsertProjectCitation(
  projectId: string,
  key: string,
  rawBibtex: string,
  doi?: string | null
) {
  const entries = parseBibtex(rawBibtex);
  const entry = entries[0];

  const citation = await prisma.citation.upsert({
    where: { projectId_key: { projectId, key } },
    create: {
      projectId,
      key,
      rawBibtex,
      doi: doi ?? null,
      title: entry?.title ?? null,
      authors: entry?.authors ?? null,
      year: entry?.year ?? null,
    },
    update: {
      rawBibtex,
      doi: doi ?? undefined,
      title: entry?.title ?? null,
      authors: entry?.authors ?? null,
      year: entry?.year ?? null,
    },
  });

  const bibFile = await prisma.file.findFirst({
    where: { projectId, path: { endsWith: ".bib" } },
  });
  if (bibFile) {
    const style = inferBibFormat(bibFile.content);
    const formatted = normalizeBibEntry(rawBibtex, style);
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existingRe = new RegExp(
      `@[\\w]+\\{${escapedKey}\\s*,[\\s\\S]*?\\n\\}`,
      "m"
    );
    let content = bibFile.content;
    if (existingRe.test(content)) {
      content = content.replace(existingRe, formatted);
    } else {
      const { content: merged } = appendBibEntries(content, [{ key, rawBibtex: formatted }]);
      content = merged;
    }
    await prisma.file.update({ where: { id: bibFile.id }, data: { content } });
  }

  return citation;
}
