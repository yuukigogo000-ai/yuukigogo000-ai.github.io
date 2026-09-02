# PACKAGE VALIDATION — PASS

- required documents: PASS
- HOME_MASTER light/dark @ width 390: PASS
- TASK_MASTER light/dark @ width 390: PASS
- STATE_VISUALS light @ width 390: PASS
- 11 screens covered: PASS
- global + screen state IDs: 56 / 56 covered
- capability IDs: 11 / 11 covered
- Function Freeze hash: matched request binding
- external dependencies declared: 0
- human depiction assets declared: 0
- text hierarchy: 5 levels
- radius variants: 3
- motion specs with purpose + reduced motion: 15 / 15
- PL-1..PL-7: explicitly covered in SCREEN_SPEC

## Request-side input normalization

`REQUIRED_COPY.json` の `CHK-PIXEL-EVAL` にある丸め値 (63%, 92%) と、`TRUST_AND_SAFETY_FACTS.json` の source-of-truth exact values (62.6%, 92.2%) が一致しない。Trust file が「source of truth」「丸め禁止」を明示しているため、本Design Returnは **62.6% / 92.2%** を正本として扱う。Design側で新規数値は作っていない。
