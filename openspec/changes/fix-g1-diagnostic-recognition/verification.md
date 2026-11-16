# Recognition diagnostic verification — 2026-11-16

- Implementation `3f08120`; planning/main-spec commits `f309e75`, `f4c38f6`, `9024dde` are separate from code.
- Full relevant Python regression: 13 modules / 159 tests passed. New helper and runner each have 14 tests; independent reviewer also passed both sets. No Actor/model/Docker calls occurred in these tests.
- `pnpm lint`, `pnpm typecheck`, OpenSpec strict validation and diff checks passed. No TS, production tools, prompt, dependency or safety-rule changes were made.
- First retained-evidence run completed all three declared modes: baseline 29.1666666667, deletion recognition 77.7777777778, deletion plus directory evidence adaptation 88.8888888889. All remain fail; the latter two are explicitly nonofficial diagnostics.
- Baseline matched all 17 score/reason pairs and total exactly. Extended results preserve typed/report checks and original layered weights/aggregation. Only two report rules remain failed in the third mode.
- Original completed G1 trial's 152 file hashes match the preexisting trial hash map; the original report SHA256 is `e140cf4dfbd81b4d21e40c008012d0ba6dbf4ec3e95b409d6d59b6aada42b721`, also identical in all three copied workspaces.
- Original trial, copied inputs, pinned source/packages, processors and actual runtime archive passed before/after integrity checks. Third-mode completeness proof validates archive and producer source hashes; it does not synthesize absent/success trace payloads.
- Actor requests here: 0. Judge logical/HTTP requests: 0. No stored task command, verifier self-test or Actor fixture was executed; the trusted pinned verifier module was imported and its read-only evaluate function called.
- Scan of 293 retained diagnostic files and 124 archive members found zero known credential or credential-pattern matches at the root audit stage. Final metadata files contain only provenance/review fields.
- Independent code review closed native correlation, typed-equality, latest-query, producer, copy immutability, baseline gating and model-rejection concerns. Actual result/document review distinguishes deletion parsing from the third mode's evidence-semantics adaptation.
- Independent result review is completed and retained; implementation/spec commits are fast-forward merged into local main. Existing unrelated untracked user files are preserved and no remote push was made.

Detailed results and exact report examples are in `eval/tracetrial/results/2026-11-16-g1-recognition-diagnostic.md`. Artifacts are under the main workspace `.agenthub-data/tracetrial-eval/2026-11-16-g1-recognition-diagnostic/`, including `diagnostic.json`, per-mode copies and scores, `audit.json` and `independent-review.json`. Original official 29.1666666667/fail remains unchanged.
