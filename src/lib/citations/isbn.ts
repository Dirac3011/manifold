import { bibEntryFromFields, suggestKeyFromMetadata } from "./format";

function normalizeIsbn(input: string): string {
  return input.replace(/[-\s]/g, "").replace(/^isbn[:\s]*/i, "");
}

export async function lookupIsbn(raw: string): Promise<{
  bibtex: string;
  suggestedKey: string;
  title: string;
  authors: string;
  year: string;
  isbn: string;
}> {
  const isbn = normalizeIsbn(raw);
  if (!/^\d{10}(\d{3})?$/.test(isbn)) throw new Error("Invalid ISBN (use 10 or 13 digits)");

  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ISBN lookup failed (${res.status})`);

  const json = await res.json();
  const book = json[`ISBN:${isbn}`];
  if (!book) throw new Error(`ISBN not found: ${isbn}`);

  const title = book.title || "Untitled";
  const authors =
    book.authors?.map((a: { name: string }) => a.name).join(" and ") || "Unknown";
  const year =
    book.publish_date?.match(/\d{4}/)?.[0] ||
    book.publish_date ||
    new Date().getFullYear().toString();
  const publisher = book.publishers?.[0]?.name || book.publish_places?.[0] || "";

  const suggestedKey = suggestKeyFromMetadata(authors, year, title);
  const bibtex = bibEntryFromFields("book", suggestedKey, {
    isbn,
    title,
    author: authors,
    year,
    publisher,
  });

  return { bibtex, suggestedKey, title, authors, year, isbn };
}
