# Sandboxed LaTeX compilation environment
# Shell escape disabled; runs as non-root user with resource limits enforced by host
FROM texlive/texlive:latest

RUN apt-get update && apt-get install -y --no-install-recommends \
    latexmk \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged compile user
RUN useradd -m -s /bin/bash compiler
WORKDIR /work
RUN chown compiler:compiler /work
USER compiler

# Default entrypoint (overridden per-profile via docker --entrypoint).
# Profiles: draft=pdflatex (1 pass), standard=latexmk+bibtex, final=latexmk+bibtex -gg
ENTRYPOINT ["latexmk", "-pdf", "-bibtex", "-interaction=nonstopmode", "-halt-on-error", "-file-line-error"]
