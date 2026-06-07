-- Manifold initial schema migration
-- Generated from prisma/schema.prisma

CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');
CREATE TYPE "MathObjectType" AS ENUM ('THEOREM', 'LEMMA', 'PROPOSITION', 'COROLLARY', 'DEFINITION', 'CONJECTURE', 'EXAMPLE', 'REMARK', 'PROBLEM', 'OPENPROBLEM', 'EXERCISE', 'PROOF', 'EQUATION');
CREATE TYPE "ObjectStatus" AS ENUM ('DRAFT', 'NEEDS_PROOF', 'PROOF_INCOMPLETE', 'PROOF_COMPLETE', 'NEEDS_REVIEW', 'REVIEWED', 'SUBMITTED_READY', 'DEPRECATED');
CREATE TYPE "LeanStatus" AS ENUM ('NOT_STARTED', 'STATEMENT_WRITTEN', 'PROOF_IN_PROGRESS', 'COMPLETE');

-- See prisma/schema.prisma for full model definitions.
-- Run: npx prisma migrate dev --name init
-- Or for quick setup: npm run db:push
