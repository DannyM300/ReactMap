# Rocket reward filter: upstream fix vs. our fix — live-data comparison

Date: 11 August 2026
Scanner data: live `incident` table, **10,715 confirmed rocket incidents**
Method: read-only (a single `SELECT`; no writes, no config/deploy changes)

## Summary

The upstream "rocket unknown form handling" fix (`5ff1a483`, by Mygod) **does not**
fully resolve the duplicate Rocket reward filters. Replayed against live scanner data, it
still produces **four duplicate species**. Our follow-up fix (`ce0f73f0` → `ef6eacb9`)
collapses all four. This document shows the result, reproduced directly from the two code
versions run over the same live incidents.

## Background — the bug

Golbat reports an **unset** reward form as `0` for several ordinary Pokemon, while the
masterfile identifies their normal form with a non-zero id (e.g. Deino `2291`, Taillow
`1400`). ReactMap builds the available Rocket reward filters from two sources:

- **confirmed scanner rewards** (`incident` table) — form often `0`
- **masterfile encounter pool** — the real, non-zero form

When those disagree for a species, ReactMap creates **two** filter keys for it
(`a<id>-0` and `a<id>-<default>`), which renders as **two identical-looking tiles**
(e.g. "Unset" and "Normal"). Because the old matcher compared the form exactly, only one
tile actually controlled the grunt; the other silently did nothing.

## The two fixes

**Upstream (`5ff1a483`)** — matches Rocket rewards by species and adds a
`collapseRocketPokemonFilterKeys` step. But:

- its availability builders still add the **raw** scanner form:
  `getRocketPokemonFilterKey(slot_1_pokemon_id, slot_1_form)` → `a276-0`, and
- `collapseRocketPokemonFilterKeys` only removes a _bare_ species key (`a276`); it never
  merges two **concrete** forms (`a276-0` and `a276-1400`).

So both keys survive → the duplicate tile remains.

**Ours (`ef6eacb9`)** — introduces `getCanonicalRocketPokemonFilterKey`, which reconciles a
scanner form of `0` to the masterfile's default form, applied at every boundary that builds
or compares Rocket keys (SQL availability, golbat availability mapper, and the matcher). A
non-zero (genuine alternate) form is preserved exactly; a missing default falls back to a
species-wide key. The two sources then produce the **same** key and collapse to one tile.

## Live result

His exact code (checked out at `ef6eacb9~1`) and ours were each run over the same
**10,715 confirmed rocket incidents** from the live scanner DB:

|                    | Rocket filter keys | Duplicate species |
| ------------------ | -----------------: | ----------------: |
| **Upstream (his)** |                 88 |             **4** |
| **Ours**           |                 84 |             **0** |

Duplicate species under the upstream fix:

| Pokemon       | Dead scanner key | Real masterfile key |
| ------------- | ---------------- | ------------------- |
| Mankey (56)   | `a56-0`          | `a56-999`           |
| Gastly (92)   | `a92-0`          | `a92-1038`          |
| Taillow (276) | `a276-0`         | `a276-1400`         |
| Deino (633)   | `a633-0`         | `a633-2291`         |

Keys present **only** in the upstream output (the dead `-0` duplicates removed by our fix):

```text
a56-0   a92-0   a276-0   a633-0
```

Genuine non-default forms in the same dataset (e.g. Alolan Sandshrew `a27-52`,
Rattata `a19-46`, Vulpix `a37-56`) are **preserved unchanged** by both — only the
`form-0`/`default` collisions are collapsed. Nothing real is lost.

## Conclusion

- **Upstream fix alone: does not resolve the duplicates** — 4 species still double up on live data.
- **Our fix: resolves all four**, with no regression to genuine alternate forms.

The comparison is reproducible and read-only: it replays the two committed code versions
(`ef6eacb9~1` vs `ef6eacb9`) over the live `incident` table and diffs the resulting Rocket
filter keys.
