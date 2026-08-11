# Rocket form-zero compatibility: implementation and test report

Date: 11 August 2026  
Branch tested: `test-main`  
Starting revision: `35fe062c`

## Conclusion

The duplicate Rocket reward filters were caused by a disagreement between the
scanner and the masterfile, not by two real Pokemon forms. Golbat reported form
`0` for several ordinary Pokemon while the masterfile identified their normal
forms with non-zero IDs. ReactMap therefore generated one key from Golbat and a
different fallback key from the masterfile.

The compatibility resolver fixes that disagreement without discarding real
alternate forms:

- A non-zero scanner form is authoritative and remains exact.
- Scanner form `0` resolves to the masterfile default when that default is
  known. This also continues to work if a future masterfile genuinely defines
  form `0` as the default.
- If the Pokemon/default is not yet present in the masterfile, form `0` becomes
  a species-wide key. Nothing new is hidden while data sources catch up.
- A missing scanner form remains species-wide; ReactMap does not invent one.

This is the same principle as the upstream fix—preserve exact scanner data and
use a safe unknown fallback—with one extra compatibility step for Golbat
deployments where `0` means “unset.”

## Before

The live Golbat snapshot contained 83 invasion definitions and produced 88
Rocket reward filter keys after ReactMap added its masterfile fallbacks. Four
species had both a scanner `-0` key and a masterfile normal-form key:

| Pokemon | Scanner key | Masterfile key |
| ------- | ----------- | -------------- |
| Mankey  | `a56-0`     | `a56-999`      |
| Gastly  | `a92-0`     | `a92-1038`     |
| Taillow | `a276-0`    | `a276-1400`    |
| Deino   | `a633-0`    | `a633-2291`    |

The `Unset` (`-0`) tile worked because confirmed live incidents contained form
`0`. The visually normal tile came from the fallback list and did not match the
raw incident. Resetting browser settings could not help because the server
advertised both definitions.

The same snapshot also contained genuine non-default forms, which must remain
separate:

| Pokemon   | Default form | Observed form | Result                |
| --------- | -----------: | ------------: | --------------------- |
| Sandshrew |           51 |            52 | preserved as `a27-52` |
| Rattata   |           45 |            46 | preserved as `a19-46` |
| Vulpix    |           55 |            56 | preserved as `a37-56` |

## Implementation

The canonical resolver is mirrored on the server and client and is used at all
of the boundaries that create or compare Rocket reward keys:

- Golbat availability mapping;
- SQL availability mapping;
- server-side invasion matching;
- map marker reward selection and sizing;
- popup exclusion actions.

The original low-level key builder is deliberately unchanged. An explicit
form `0` still means exact form zero when no scanner/masterfile reconciliation
has been requested. This retains the upstream semantics for other callers.

There is also a settings migration. If an existing profile/browser has a
working `a<id>-0` selection and the corrected server definition is
`a<id>-<default>`, the old working tile's settings are copied to the canonical
tile before the obsolete key is removed. Users do not silently lose their
Rocket selection when updating.

## After replay

Replaying the seven live edge cases through the corrected Golbat mapper gives:

```text
a56-999       Mankey normal
a92-1038      Gastly normal
a276-1400     Taillow normal
a633-2291     Deino normal
a27-52        Alolan Sandshrew (preserved)
a19-46        Alolan Rattata (preserved)
a37-56        Alolan Vulpix (preserved)
```

No `-0` duplicate remains for the four affected species. Applying this to the
captured availability set reduces its Rocket keys from 88 to 84: exactly the
four dead duplicates are removed. No real alternate key is collapsed.

## Test results

### Automated repository tests

- Full `yarn test`: **18 passed, 0 failed**
  - masterfile package: 4 passed;
  - Rocket/server regression suite: 14 passed.
- ESLint: **passed**.
- Production Vite build: **passed** (2,377 modules transformed).
- `git diff --check`: **passed**.

The Rocket suite covers:

- known non-zero defaults receiving scanner form `0`;
- a genuine default form `0`;
- a Pokemon missing from the masterfile;
- authoritative non-zero alternate forms;
- the seven live Golbat cases above;
- Golbat and SQL availability paths;
- server matching, partial confirmed lineups and fallback encounters;
- excluded leaders, Giovanni and Decoys.

### Exhaustive current-masterfile audit

The resolver was run against the generated masterfile rather than only the
known failing Pokemon:

| Check                          | Result |
| ------------------------------ | -----: |
| Pokemon species checked        |  1,025 |
| Form records checked           |  1,489 |
| Non-zero forms verified exact  |  1,488 |
| Species with non-zero defaults |  1,024 |
| Species with a zero default    |      1 |
| Incorrectly resolved keys      |  **0** |

For every species, scanner form `0` resolved to its declared default. Every
non-zero form remained byte-for-byte the same exact filter key.

## Future behaviour

- If the masterfile later changes a Pokemon's default, a scanner `0` value will
  automatically follow the new declared default. No species-specific patch is
  required.
- If Golbat starts sending the real non-zero form, that value is already
  authoritative and produces the same key.
- If Golbat sends a new non-zero form before the masterfile knows its label, the
  key is retained. The icon/name can temporarily fall back, but filtering does
  not hide it.
- If a completely new Pokemon arrives as form `0` before the masterfile knows
  it, the species-wide key remains usable until the masterfile catches up.

## Scope

This change only reconciles Rocket reward Pokemon form keys. It does not alter
quest Pokemon forms, wild Pokemon filters, invasion-type filters, leader
exclusions, reward-slot configuration or task filtering.
