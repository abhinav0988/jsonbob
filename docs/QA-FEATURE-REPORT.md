# jsonbob — QA Feature Validation Report

**Generated:** 2026-07-20T07:34:05.850Z
**Target:** https://jsonbob-web.abhinavmangal68.workers.dev
**Duration:** 69s

## Summary

| Metric | Count |
|--------|------:|
| Total checks | 42 |
| Passed | 42 |
| Failed | 0 |
| Skipped | 0 |
| **Pass rate** | **100%** |

## By feature

| Feature | Pass | Fail | Skip | Status |
|---------|-----:|-----:|-----:|--------|
| Landing | 2 | 0 | 0 | ✅ OK |
| Guest Editor | 6 | 0 | 0 | ✅ OK |
| Public View | 2 | 0 | 0 | ✅ OK |
| Compare JSON | 10 | 0 | 0 | ✅ OK |
| API Playground | 3 | 0 | 0 | ✅ OK |
| Auth / Register | 3 | 0 | 0 | ✅ OK |
| Route Guards | 2 | 0 | 0 | ✅ OK |
| Auth / Login | 2 | 0 | 0 | ✅ OK |
| Dashboard | 2 | 0 | 0 | ✅ OK |
| Document Save | 3 | 0 | 0 | ✅ OK |
| Settings | 7 | 0 | 0 | ✅ OK |

---

## Landing

| ID | Test case | Result | Notes |
|----|-----------|--------|-------|
| FV-L01 | Home page loads with hero | ✅ PASS |  |
| FV-L02 | Open editor CTA navigates to /documents/new | ✅ PASS |  |

## Guest Editor

| ID | Test case | Result | Notes |
|----|-----------|--------|-------|
| FV-E01 | Workspace shell visible | ✅ PASS |  |
| FV-E02 | Valid JSON: Format succeeds | ✅ PASS |  |
| FV-E03 | Valid JSON: Save creates public view | ✅ PASS |  |
| FV-E04 | Invalid JSON: Save blocked with error | ✅ PASS |  |
| FV-E05 | Invalid JSON: Minify shows notice | ✅ PASS |  |
| FV-E06 | Random valid JSON round-trip | ✅ PASS |  |

## Public View

| ID | Test case | Result | Notes |
|----|-----------|--------|-------|
| FV-P01 | Saved public URL loads | ✅ PASS |  |
| FV-P02 | Reload keeps same document | ✅ PASS |  |

## Compare JSON

| ID | Test case | Result | Notes |
|----|-----------|--------|-------|
| FV-C01 | Compare page loads with sample diffs | ✅ PASS |  |
| FV-C02 | Format both (valid JSON) | ✅ PASS |  |
| FV-C03 | Swap A/B keeps page stable | ✅ PASS |  |
| FV-C04 | Ignore key order: reordered JSON matches | ✅ PASS |  |
| FV-C05 | Invalid JSON transform shows error toast | ✅ PASS |  |
| FV-C06-{not-jso | Invalid JSON "{not-json" blocks format both | ✅ PASS |  |
| FV-C06-{"a":} | Invalid JSON "{"a":}" blocks format both | ✅ PASS |  |
| FV-C07 | Accept all from A toast | ✅ PASS |  |
| FV-C08 | Diff navigation when diffs exist | ✅ PASS |  |
| FV-C09 | Pane mode Text / Tree / Table switches | ✅ PASS |  |

## API Playground

| ID | Test case | Result | Notes |
|----|-----------|--------|-------|
| FV-A01 | Page loads | ✅ PASS |  |
| FV-A02 | GET /health returns 200 | ✅ PASS |  |
| FV-A03 | Invalid path returns 404 | ✅ PASS |  |

## Auth / Register

| ID | Test case | Result | Notes |
|----|-----------|--------|-------|
| FV-R01 | Short password blocked (< 8 chars) | ✅ PASS |  |
| FV-R02 | Invalid email format blocked | ✅ PASS |  |
| FV-R03 | Valid registration succeeds | ✅ PASS |  |

## Route Guards

| ID | Test case | Result | Notes |
|----|-----------|--------|-------|
| FV-G01 | Guest /dashboard → login | ✅ PASS |  |
| FV-G02 | Guest /settings → login | ✅ PASS |  |

## Auth / Login

| ID | Test case | Result | Notes |
|----|-----------|--------|-------|
| FV-LG01 | Wrong password shows error | ✅ PASS |  |
| FV-LG02 | Valid login succeeds | ✅ PASS |  |

## Dashboard

| ID | Test case | Result | Notes |
|----|-----------|--------|-------|
| FV-D01 | Dashboard loads when authenticated | ✅ PASS |  |
| FV-D02 | Random search string does not crash | ✅ PASS |  |

## Document Save

| ID | Test case | Result | Notes |
|----|-----------|--------|-------|
| FV-S01 | Create doc with valid JSON | ✅ PASS |  |
| FV-S02 | Password doc: short password blocked | ✅ PASS |  |
| FV-S03 | Password doc: valid password saves | ✅ PASS |  |

## Settings

| ID | Test case | Result | Notes |
|----|-----------|--------|-------|
| FV-ST01 | Settings page loads | ✅ PASS |  |
| FV-ST-Profile | Profile section opens | ✅ PASS |  |
| FV-ST-Appearance | Appearance section opens | ✅ PASS |  |
| FV-ST-API Keys | API Keys section opens | ✅ PASS |  |
| FV-ST-OAuth | OAuth section opens | ✅ PASS |  |
| FV-ST-Organization | Organization section opens | ✅ PASS |  |
| FV-ST-Audit log | Audit log section opens | ✅ PASS |  |
