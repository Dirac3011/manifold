import { Prisma } from "@prisma/client";

/** Shared include for sidebar outline — avoids over-fetching object detail fields. */
export const objectListInclude = {
  assignee: { select: { id: true, name: true, username: true } },
  thread: {
    include: {
      comments: {
        where: { resolved: false, parentId: null },
        select: {
          id: true,
          resolved: true,
          content: true,
          author: { select: { name: true, username: true } },
        },
      },
    },
  },
  citedIn: {
    select: {
      citeKey: true,
      citation: { select: { key: true } },
    },
  },
  depsFrom: {
    take: 1,
    include: { to: { select: { label: true, type: true } } },
  },
  file: { select: { path: true } },
} satisfies Prisma.MathObjectInclude;

export type ObjectListItem = Prisma.MathObjectGetPayload<{
  include: typeof objectListInclude;
}>;
