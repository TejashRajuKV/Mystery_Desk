#!/usr/bin/env python3
"""
MysteryDesk edge-case runner (EC-01 .. EC-48 from docs/qa/edge-cases/test-cases.md).

Drives the real backend over HTTP and checks every edge case, then prints PASS/FAIL
with what it actually saw. Standard library only (no pip install needed).

WARNING: this calls POST /api/cases/<id>/reset on all five cases, so it WIPES your
player progress. Run it against a throwaway database:

    # terminal 1 (backend/):
    #   Windows PowerShell:  $env:DB_PATH="$PWD\\storage\\edge.sqlite"; $env:PORT="4100"; node src/server.js
    #   bash:                DB_PATH=./storage/edge.sqlite PORT=4100 node src/server.js
    # terminal 2 (repo root):
    python edge_cases.py --base http://localhost:4100/api --yes

Options:
    --base   API base URL            (default http://localhost:4000/api)
    --data   path to data/cases      (default: <repo>/data/cases, found next to this file)
    --yes    skip the "this resets progress" prompt
    --json   also write results to this JSON file

It reads solution.json only to pick the culprit vs. an innocent; it never prints the key.
Exit code is 0 when everything passes, 1 otherwise.
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

# ---------------------------------------------------------------- setup

parser = argparse.ArgumentParser(description="MysteryDesk edge-case runner")
parser.add_argument("--base", default="http://localhost:4000/api")
parser.add_argument("--data", default=None)
parser.add_argument("--yes", action="store_true")
parser.add_argument("--json", default=None)
args = parser.parse_args()

BASE = args.base.rstrip("/")
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = args.data or next(
    (p for p in [os.path.join(HERE, "data", "cases"), os.path.join(HERE, "..", "data", "cases")] if os.path.isdir(p)),
    os.path.join(HERE, "data", "cases"),
)
if not os.path.isdir(DATA):
    sys.exit(f"Can't find data/cases at {DATA}. Pass --data path/to/data/cases")

if not args.yes:
    ans = input(f"This resets progress on all five cases at {BASE}. Continue? [y/N] ")
    if ans.strip().lower() != "y":
        sys.exit("Aborted.")

CASES = ["047", "048", "049", "050", "051"]
results = []
_cache = {}


def load(c, f):
    key = (c, f)
    if key not in _cache:
        with open(os.path.join(DATA, c, f + ".json"), encoding="utf-8") as fh:
            _cache[key] = json.load(fh)
    return _cache[key]


class Resp:
    def __init__(self, status, body):
        self.status = status
        self.body = body


_MISSING = object()


def call(method, path, body=_MISSING, raw=None, content_type="application/json"):
    data = None
    headers = {}
    if raw is not None:
        data = raw.encode("utf-8")
        headers["content-type"] = content_type
    elif body is not _MISSING:
        data = json.dumps(body).encode("utf-8")
        headers["content-type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as res:
            status, text = res.status, res.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        status, text = e.code, e.read().decode("utf-8")
    except urllib.error.URLError as e:
        sys.exit(f"Can't reach the backend at {BASE}: {e.reason}. Is it running?")
    try:
        parsed = json.loads(text) if text else None
    except ValueError:
        parsed = text
    return Resp(status, parsed)


def get(p): return call("GET", p)
def post(p, b=_MISSING): return call("POST", p, b)
def put(p, b): return call("PUT", p, b)
def delete(p): return call("DELETE", p)
def reset(c): return post(f"/cases/{c}/reset")
def inv(c): return get(f"/cases/{c}/investigation").body
def dump(x): return json.dumps(x, ensure_ascii=False)
def st(r): return f"{r.status} {dump(r.body)[:160]}"


def record(id_, title, passed, observed):
    passed = bool(passed)
    results.append({"id": id_, "title": title, "pass": passed, "observed": observed})
    print(f"{'PASS' if passed else 'FAIL'} {id_} {title}\n     {observed}")


def locs(c): return load(c, "locations")


def where_is(c, s):
    return next(l["id"] for l in locs(c) if s in (l.get("people") or []))


def free_spot(c):
    for l in locs(c):
        for s in l.get("spots") or []:
            cons = s.get("consequences") or []
            if not s.get("requires") and any(q["type"] == "unlock_evidence" for q in cons):
                ev = next(q["evidenceId"] for q in cons if q["type"] == "unlock_evidence")
                return {"l": l["id"], "s": s["id"], "e": ev}
    raise RuntimeError(f"no free search spot in {c}")


def unlock_by_search(c, evidence_id):
    for l in locs(c):
        for s in l.get("spots") or []:
            if s.get("requires"):
                continue
            if any(q.get("evidenceId") == evidence_id for q in s.get("consequences") or []):
                post(f"/cases/{c}/travel", {"locationId": l["id"]})
                return post(f"/cases/{c}/places/{l['id']}/search", {"spotId": s["id"]})
    raise RuntimeError(f"no free spot for {evidence_id} in {c}")


def search_free_spot(c, spot):
    post(f"/cases/{c}/travel", {"locationId": spot["l"]})
    post(f"/cases/{c}/places/{spot['l']}/search", {"spotId": spot["s"]})


def matrix(rows):
    return all(r.status == exp for _, r, exp in rows), ", ".join(f"{k}: {r.status}" for k, r, _ in rows)


# ================================================================ A. routing & case scope

out = []
for b in ["999", "047x", "047%20", "..%2F047", "46"]:
    out.append([b, get(f"/cases/{b}").status, get(f"/cases/{b}/evidence").status])
record("EC-01", "Unknown / malformed caseId is a 404 on the case and every sub-route",
       all(a == 404 and b == 404 for _, a, b in out), dump(out))

r = get("/nope")
r2 = get("/cases/047/nope")
record("EC-02", "Unknown API route returns 404 { error }",
       r.status == 404 and isinstance(r.body, dict) and r.body.get("error") and r2.status == 404, f"{st(r)} | {st(r2)}")

raw = call("POST", "/cases/047/viewed", raw='{"type": "evidence", ')
record("EC-03", "Malformed JSON body is a 400 { error }, not a 500",
       raw.status == 400 and isinstance(raw.body, dict) and isinstance(raw.body.get("error"), str), st(raw))

text = call("POST", "/cases/047/viewed", raw="type=evidence", content_type="text/plain")
record("EC-04", "Non-JSON content-type body is treated as empty -> 400", text.status == 400, st(text))

for c in CASES:
    reset(c)
spot = free_spot("050")
search_free_spot("050", spot)
a, b = inv("050"), inv("047")
e047 = get(f"/cases/047/evidence/{spot['e']}")
record("EC-05", "Per-case isolation: evidence/clock/location in one case never leak into another",
       spot["e"] in a["unlockedEvidence"] and spot["e"] not in b["unlockedEvidence"]
       and b["clock"]["minutesUsed"] == 0 and b["locationId"] is None and e047.status == 404,
       f"050 unlocked={a['unlockedEvidence']} used={a['clock']['minutesUsed']}; 047 unlocked={b['unlockedEvidence']} "
       f"used={b['clock']['minutesUsed']} loc={b['locationId']}; GET 047/evidence/{spot['e']} -> {e047.status}")
reset("050")

leaks = []
key_re = re.compile(r'"(culprit|requiredEvidence|requiredConnections|solution)"')
if key_re.search(dump(get("/cases").body)):
    leaks.append("/cases")
for c in CASES:
    for p in ["", "/evidence", "/suspects", "/statements", "/timeline", "/connections", "/investigation", "/file", "/places", "/notes"]:
        if key_re.search(dump(get(f"/cases/{c}{p}").body)):
            leaks.append(c + p)
record("EC-06", "No GET on any case exposes culprit / requiredEvidence / requiredConnections",
       not leaks, ", ".join(leaks) if leaks else "0 leaks across 5 cases x 10 routes + desk")

reset("048")
before = dump(inv("048"))
for p in ["", "/evidence", "/suspects", "/statements", "/timeline", "/connections", "/file", "/places", "/notes",
          "/places/L01", "/dialogue/S01", "/report", "/facts/S01"]:
    get(f"/cases/048{p}")
after = dump(inv("048"))
record("EC-07", "Hitting every GET route leaves investigation state byte-identical",
       before == after, "identical" if before == after else "CHANGED")

# ================================================================ B. case clock

c = "050"
reset(c)
cs = load(c, "case")
s = inv(c)
record("EC-08", "Fresh case clock: 0 used, now = start, deadline = start + hours, not timeUp",
       s["clock"]["minutesUsed"] == 0 and s["clock"]["now"] == cs["clock"]["start"]
       and s["clock"]["minutesLeft"] == cs["clock"]["hours"] * 60 and not s["clock"]["timeUp"], dump(s["clock"]))

loc = free_spot(c)
used = lambda: inv(c)["clock"]["minutesUsed"]
post(f"/cases/{c}/travel", {"locationId": loc["l"]}); t1 = used()
post(f"/cases/{c}/travel", {"locationId": loc["l"]})
post(f"/cases/{c}/places/{loc['l']}/search", {"spotId": loc["s"]}); t2 = used()
post(f"/cases/{c}/places/{loc['l']}/search", {"spotId": loc["s"]})
post(f"/cases/{c}/file/F1/read"); t3 = used()
post(f"/cases/{c}/file/F1/read"); t4 = used()
record("EC-09", "Repeat actions are free: travel to where you stand, re-search a spot, re-read a page",
       (t1, t2, t3, t4) == (30, 45, 65, 65),
       f"after travel={t1}, +same travel +search={t2}, +re-search +read F1={t3}, +re-read F1={t4}")

reset(c)
ids = [l["id"] for l in locs(c)]
post(f"/cases/{c}/file/F1/read")
post(f"/cases/{c}/travel", {"locationId": loc["l"]})
post(f"/cases/{c}/places/{loc['l']}/search", {"spotId": loc["s"]})
i = 0
while inv(c)["clock"]["minutesLeft"] > 30:
    here = inv(c)["locationId"]
    nxt = next((x for x in ids if x != here and x != ids[i % len(ids)]), ids[0])
    post(f"/cases/{c}/travel", {"locationId": nxt})
    i += 1
pre = inv(c)["clock"]
here = inv(c)["locationId"]
other = next(l["id"] for l in locs(c) if l["id"] != here and l.get("people")
             and any(not sp.get("requires") and sp["id"] != loc["s"] for sp in l.get("spots") or []))
last = post(f"/cases/{c}/travel", {"locationId": other})
p1 = inv(c)["clock"]
record("EC-10", "Last action may overshoot the deadline: allowed once, then now is clamped to deadline and minutesLeft = 0",
       last.status == 200 and p1["timeUp"] and p1["minutesLeft"] == 0 and p1["now"] == p1["deadline"],
       f"before: left={pre['minutesLeft']}; travel -> {last.status}; after: used={p1['minutesUsed']} "
       f"left={p1['minutesLeft']} now={p1['now']} deadline={p1['deadline']}")

here2 = inv(c)["locationId"]
other2 = next(x for x in ids if x != here2)
res = {
    "travelElsewhere": post(f"/cases/{c}/travel", {"locationId": other2}).status,
    "travelSame": post(f"/cases/{c}/travel", {"locationId": here2}).status,
    "readUnread": post(f"/cases/{c}/file/F3/read").status,
    "rereadF1": post(f"/cases/{c}/file/F1/read").status,
    "getPlace": get(f"/cases/{c}/places/{here2}").status,
}
place = next(l for l in locs(c) if l["id"] == here2)
done = set(inv(c)["spotsSearched"])
unsearched = next((sp for sp in place.get("spots") or [] if not sp.get("requires") and sp["id"] not in done), None)
res["search"] = post(f"/cases/{c}/places/{here2}/search", {"spotId": unsearched["id"]}).status if unsearched else "n/a"
person = (place.get("people") or [None])[0]
if person:
    dlg = get(f"/cases/{c}/dialogue/{person}").body
    q = next(x for x in dlg["choices"] if not x["leaves"])
    lv = next(x for x in dlg["choices"] if x["leaves"])
    res["question"] = post(f"/cases/{c}/dialogue/{person}/choice", {"choiceId": q["id"]}).status
    res["leave"] = post(f"/cases/{c}/dialogue/{person}/choice", {"choiceId": lv["id"]}).status
ok = (res["travelElsewhere"] == 422 and res["travelSame"] == 200 and res["readUnread"] == 422
      and res["rereadF1"] == 200 and res["getPlace"] == 200 and res["search"] in (422, "n/a")
      and (not person or (res["question"] == 422 and res["leave"] == 200)))
record("EC-11", "After time is up: every time-costing action is 422; free actions (stay, re-read, look, leave) still 200", ok, dump(res))

concl = post(f"/cases/{c}/conclusion", {"suspectId": None})
record("EC-12", "Accusation is still accepted after time is up", concl.status == 200, st(concl))
reset(c)

# ================================================================ C. places, search, file

c = "050"
reset(c)
r1 = get(f"/cases/{c}/places/L02")
r2 = get(f"/cases/{c}/places/L99")
record("EC-13", "Looking at a place you are not standing in is 422; an unknown place is 404 (404 wins)",
       r1.status == 422 and r2.status == 404, f"{st(r1)} | {st(r2)}")

bad = [
    ("no body", post(f"/cases/{c}/travel"), 400),
    ("locationId number", post(f"/cases/{c}/travel", {"locationId": 2}), 400),
    ("unknown L99", post(f"/cases/{c}/travel", {"locationId": "L99"}), 404),
    ("lowercase l02", post(f"/cases/{c}/travel", {"locationId": "l02"}), 404),
]
ok, obs = matrix(bad)
clock = inv(c)["clock"]["minutesUsed"]
record("EC-14", "Bad travel bodies: missing/non-string -> 400, unknown/wrong-case ID -> 404, no time spent",
       ok and clock == 0, f"{obs}; minutesUsed={clock}")

post(f"/cases/{c}/travel", {"locationId": "L01"})
listed = [sp["id"] for sp in get(f"/cases/{c}/places/L01").body["spots"]]
gated = post(f"/cases/{c}/places/L01/search", {"spotId": "L01-panel"})
foreign = post(f"/cases/{c}/places/L01/search", {"spotId": "L02-desk"})
nospot = post(f"/cases/{c}/places/L01/search", {})
numspot = post(f"/cases/{c}/places/L01/search", {"spotId": 1})
not_there = post(f"/cases/{c}/places/L02/search", {"spotId": "L02-desk"})
post(f"/cases/{c}/file/F2/read")
now_listed = [sp["id"] for sp in get(f"/cases/{c}/places/L01").body["spots"]]
record("EC-15", "Gated search spot is hidden and 404s exactly like a spot that does not exist, until its flag is set",
       "L01-panel" not in listed and gated.status == 404 and foreign.status == 404
       and gated.body.get("error") == foreign.body.get("error") and "L01-panel" in now_listed,
       f"before F2: spots={listed}; gated -> {gated.status} \"{gated.body.get('error')}\"; "
       f"foreign spot -> {foreign.status} \"{foreign.body.get('error')}\"; after F2: spots={now_listed}")
record("EC-16", "Search validation: missing/non-string spotId -> 400; searching a place you are not in -> 422",
       nospot.status == 400 and numspot.status == 400 and not_there.status == 422,
       f"{nospot.status}, {numspot.status}, {not_there.status}")

reset(c)
f = get(f"/cases/{c}/file").body
case_body = get(f"/cases/{c}").body
pg = post(f"/cases/{c}/file/F9/read")
record("EC-17", "Unread page bodies are null, GET /cases/:id has no file text, unknown page is 404 and costs nothing",
       all(p["body"] is None and not p["attachments"] for p in f) and "file" not in case_body
       and pg.status == 404 and inv(c)["clock"]["minutesUsed"] == 0,
       f"bodies null: {all(p['body'] is None for p in f)}; case has 'file': {'file' in case_body}; F9 -> {pg.status}")

# ================================================================ D. interviews

c = "050"
reset(c)
s, home = "S02", where_is("050", "S02")
away = post(f"/cases/{c}/dialogue/{s}/choice", {"choiceId": "mf-start-service"})
unknown = post(f"/cases/{c}/dialogue/S99/choice", {"choiceId": "x"})
unknown_get = get(f"/cases/{c}/dialogue/S99")
record("EC-18", "Questioning someone who is not where you are -> 422; unknown suspect -> 404 (GET and POST)",
       away.status == 422 and unknown.status == 404 and unknown_get.status == 404,
       f"{st(away)} | {unknown.status} | {unknown_get.status}")

post(f"/cases/{c}/travel", {"locationId": home})
both = post(f"/cases/{c}/dialogue/{s}/choice", {"choiceId": "mf-start-service", "presentEvidenceId": "E004"})
neither = post(f"/cases/{c}/dialogue/{s}/choice", {})
numeric = post(f"/cases/{c}/dialogue/{s}/choice", {"choiceId": 5})
record("EC-19", "Choice body must be exactly one of { choiceId } / { presentEvidenceId }: both, neither or non-string -> 400",
       both.status == neither.status == numeric.status == 400, f"{both.status}, {neither.status}, {numeric.status}")

null_present = post(f"/cases/{c}/dialogue/{s}/choice", {"choiceId": "mf-start-service", "presentEvidenceId": None})
record("EC-20", "{ choiceId, presentEvidenceId: null } should be treated as a plain spoken choice",
       null_present.status == 200, f"{st(null_present)}  <- null is not undefined, so applyChoice takes the present-evidence branch")
reset(c)
post(f"/cases/{c}/travel", {"locationId": home})

listed = [x["id"] for x in get(f"/cases/{c}/dialogue/{s}").body["choices"]]
reaction_as_choice = post(f"/cases/{c}/dialogue/{s}/choice", {"choiceId": "mf-start-e004"})
wrong_node = post(f"/cases/{c}/dialogue/{s}/choice", {"choiceId": "oh-start-night"})
record("EC-21", "Evidence reactions are never listed and can't be triggered as a spoken choiceId; another suspect's choice -> 422",
       "mf-start-e004" not in listed and reaction_as_choice.status == 422 and wrong_node.status == 422,
       f"listed={listed}; mf-start-e004 as choiceId -> {reaction_as_choice.status}; oh-start-night -> {wrong_node.status}")

locked = post(f"/cases/{c}/dialogue/{s}/choice", {"presentEvidenceId": "E004"})
bogus = post(f"/cases/{c}/dialogue/{s}/choice", {"presentEvidenceId": "E999"})
record("EC-22", "Presenting a locked or non-existent exhibit -> 422 with the same message (no existence oracle)",
       locked.status == 422 and bogus.status == 422 and locked.body.get("error") == bogus.body.get("error"),
       f"{st(locked)} | {st(bogus)}")

home_spot = next(x for x in next(l for l in locs(c) if l["id"] == home)["spots"]
                 if x.get("consequences") and not x.get("requires"))
post(f"/cases/{c}/places/{home}/search", {"spotId": home_spot["id"]})
eid = home_spot["consequences"][0]["evidenceId"]
t0 = used()
unmoved = post(f"/cases/{c}/dialogue/{s}/choice", {"presentEvidenceId": eid})
t1 = used()
tree = load(c, "dialogue")["interviews"][s]
is_reaction = any(x.get("present") == eid for x in tree["nodes"][tree["startNode"]]["choices"])
ub = unmoved.body if isinstance(unmoved.body, dict) else {}
record("EC-23", "Presenting an unlocked exhibit with no scripted reaction -> presentFallback, 'unmoved', 10 min, marked viewed",
       unmoved.status == 200 and (is_reaction or ub["presented"]["reaction"] == "unmoved")
       and t1 - t0 == 10 and eid in ub["investigation"]["evidenceViewed"],
       f"presented {eid} (scripted reaction: {is_reaction}) -> {unmoved.status}, "
       f"reaction={(ub.get('presented') or {}).get('reaction')}, node={(ub.get('dialogue') or {}).get('nodeId')}, cost={t1 - t0}")

back = get(f"/cases/{c}/dialogue/{s}").body
leave = next((x for x in back["choices"] if x["leaves"]), back["choices"][-1])
t2 = used()
lv = post(f"/cases/{c}/dialogue/{s}/choice", {"choiceId": leave["id"]})
t3 = used()
after_leave = get(f"/cases/{c}/dialogue/{s}").body
record("EC-24", "Leaving / stepping back costs no time; leaving resets the interview to its opening node",
       lv.status == 200 and t3 == t2 and after_leave["nodeId"] == tree["startNode"],
       f"choice {leave['id']} -> {lv.status}, cost={t3 - t2}, node now {after_leave['nodeId']}")

reset(c)
post(f"/cases/{c}/travel", {"locationId": where_is(c, "S03")})
gated_choice = post(f"/cases/{c}/dialogue/S03/choice", {"choiceId": "tr-start-codes"})
listed_s3 = [x["id"] for x in get(f"/cases/{c}/dialogue/S03").body["choices"]]
record("EC-25", "A choice whose requires is unmet is not listed and is a 422 if sent anyway (tr-start-codes before F2)",
       "tr-start-codes" not in listed_s3 and gated_choice.status == 422,
       f"listed={listed_s3}; forced -> {gated_choice.status}")
reset(c)

# ================================================================ E. connections

c = "047"
reset(c)
spot = free_spot(c)
search_free_spot(c, spot)
e = spot["e"]
attached = {i for p in load(c, "case")["file"] for i in (p.get("attachments") or [])}
locked_e = next(x["id"] for x in load(c, "evidence") if x["id"] != e and x["id"] not in attached)
claim = load(c, "statements")[0]["assertions"][0]["id"]
rows = [
    ("self-link", {"source": "S01", "target": "S01"}, 422),
    ("unknown S99", {"source": "S99", "target": "S01"}, 422),
    ("lowercase s01", {"source": "s01", "target": "S02"}, 422),
    ("empty string", {"source": "", "target": "S01"}, 422),
    ("locked evidence", {"source": locked_e, "target": "S01"}, 422),
    ("unknown claim ST09-Z", {"source": "ST09-Z", "target": "S01"}, 422),
    ("relationship caused_by", {"source": "S01", "target": "S02", "relationship": "caused_by"}, 422),
    ("source is number", {"source": 1, "target": "S01"}, 400),
    ("relationship null -> default", {"source": "S01", "target": "S02", "relationship": None}, 201),
    ("no relationship -> default", {"source": e, "target": "S01"}, 201),
    ("reverse duplicate", {"source": "S01", "target": e}, 422),
    ("claim to location", {"source": claim, "target": "L01"}, 201),
]
out = []
for k, body, exp in rows:
    got = post(f"/cases/{c}/connections", body).status
    out.append(f"{k}: {got}" + (f" (expected {exp})" if got != exp else ""))
record("EC-26", "Connection validation matrix", not any("expected" in x for x in out), "; ".join(out))

lst = get(f"/cases/{c}/connections").body
d1 = delete(f"/cases/{c}/connections/{lst[0]['id']}")
d2 = delete(f"/cases/{c}/connections/{lst[0]['id']}")
d3 = delete(f"/cases/{c}/connections/C99")
n = post(f"/cases/{c}/connections", {"source": "S02", "target": "S03"})
reset(c)
after_reset = post(f"/cases/{c}/connections", {"source": "S02", "target": "S03"})
record("EC-27", "Delete: 204 then 404 on repeat, unknown -> 404; deleted IDs are never reused; reset restarts at C01",
       d1.status == 204 and d2.status == 404 and d3.status == 404
       and n.body["id"] == f"C{len(lst) + 1:02d}" and after_reset.body["id"] == "C01",
       f"delete {lst[0]['id']}: {d1.status}, again: {d2.status}, C99: {d3.status}; "
       f"next id={n.body['id']}; after reset={after_reset.body['id']}")

reset(c)
hidden_t = next(t for t in load(c, "timeline") if t["evidenceIds"])
lt = post(f"/cases/{c}/connections", {"source": hidden_t["id"], "target": "S01"})
vt = post(f"/cases/{c}/viewed", {"type": "event", "id": hidden_t["id"]})
record("EC-28", "A timeline event whose exhibits are all still locked cannot be linked (422) or viewed (404)",
       lt.status == 422 and vt.status == 404, f"{hidden_t['id']}: link -> {lt.status}, view -> {vt.status}")

# ================================================================ F. contradictions / viewed / theory

c = "047"
reset(c)
claim = load(c, "statements")[0]["assertions"][0]["id"]
ok, obs = matrix([
    ("types wrong", post(f"/cases/{c}/contradictions", {"assertionId": 1, "evidenceId": "E001"}), 400),
    ("unknown claim", post(f"/cases/{c}/contradictions", {"assertionId": "ST99-A", "evidenceId": "E001"}), 404),
    ("locked evidence", post(f"/cases/{c}/contradictions", {"assertionId": claim, "evidenceId": "E001"}), 404),
])
record("EC-29", "Contradiction validation: bad types 400, unknown claim 404, locked exhibit 404", ok, obs)

ok, obs = matrix([
    ("type page", post(f"/cases/{c}/viewed", {"type": "page", "id": "F1"}), 400),
    ("id number", post(f"/cases/{c}/viewed", {"type": "suspect", "id": 1}), 400),
    ("unknown suspect", post(f"/cases/{c}/viewed", {"type": "suspect", "id": "S99"}), 404),
    ("locked evidence", post(f"/cases/{c}/viewed", {"type": "evidence", "id": "E001"}), 404),
])
record("EC-30", "POST /viewed: only evidence|suspect|event, unknown/locked -> 404", ok, obs)

weird = "It was 'Alex'; DROP TABLE views;-- \U0001F50D"
ok, obs = matrix([
    ("5000 chars", put(f"/cases/{c}/theory", {"text": "x" * 5000}), 200),
    ("5001 chars", put(f"/cases/{c}/theory", {"text": "x" * 5001}), 400),
    ("empty", put(f"/cases/{c}/theory", {"text": ""}), 200),
    ("number", put(f"/cases/{c}/theory", {"text": 42}), 400),
    ("emoji / quotes / SQL", put(f"/cases/{c}/theory", {"text": weird}), 200),
])
saved = inv(c)["theory"]
record("EC-31", "Theory boundaries: 5000 ok, 5001 -> 400, empty ok, non-string 400, quotes/emoji/SQL stored verbatim",
       ok and saved == weird, f"{obs} | stored verbatim: {saved == weird}")

# ================================================================ G. conclusion & endings

for c in CASES:
    reset(c)
    culprit = load(c, "solution")["culprit"]
    innocent = next(x["id"] for x in load(c, "suspects") if x["id"] != culprit)
    spot = free_spot(c)
    search_free_spot(c, spot)

    if c == "047":
        rep = get(f"/cases/{c}/report")
        ok, obs = matrix([
            ("{}", post(f"/cases/{c}/conclusion", {}), 400),
            ("suspect + []", post(f"/cases/{c}/conclusion", {"suspectId": innocent, "evidenceIds": []}), 400),
            ("evidenceIds string", post(f"/cases/{c}/conclusion", {"suspectId": innocent, "evidenceIds": spot["e"]}), 400),
            ("evidenceIds [123]", post(f"/cases/{c}/conclusion", {"suspectId": innocent, "evidenceIds": [123]}), 400),
            ("null + evidenceIds 'x'", post(f"/cases/{c}/conclusion", {"suspectId": None, "evidenceIds": "x"}), 400),
            ("unknown S99", post(f"/cases/{c}/conclusion", {"suspectId": "S99", "evidenceIds": [spot["e"]]}), 422),
            ("locked exhibit", post(f"/cases/{c}/conclusion", {"suspectId": innocent, "evidenceIds": ["E999"]}), 422),
            ("null + locked exhibit", post(f"/cases/{c}/conclusion", {"suspectId": None, "evidenceIds": ["E999"]}), 422),
        ])
        still = inv(c)["conclusion"]
        record("EC-32", "Conclusion validation matrix; rejected bodies don't close the case; report before conclusion is 422",
               ok and still is None and rep.status == 422, f"{obs} | report: {rep.status}")

    thin = post(f"/cases/{c}/conclusion", {"suspectId": culprit, "evidenceIds": [spot["e"], spot["e"]]})
    second = post(f"/cases/{c}/conclusion", {"suspectId": None})
    report = get(f"/cases/{c}/report")
    after_close = {
        "link": post(f"/cases/{c}/connections", {"source": "S01", "target": "S02"}).status,
        "theory": put(f"/cases/{c}/theory", {"text": "edited after close"}).status,
        "viewed": post(f"/cases/{c}/viewed", {"type": "suspect", "id": "S01"}).status,
        "travel": post(f"/cases/{c}/travel", {"locationId": next(l["id"] for l in locs(c) if l["id"] != spot["l"])}).status,
    }
    report2 = get(f"/cases/{c}/report")
    desk = next(x for x in get("/cases").body if x["id"] == c)

    reset(c)
    search_free_spot(c, spot)
    wrong_thin = post(f"/cases/{c}/conclusion", {"suspectId": innocent, "evidenceIds": [spot["e"]]})
    wrong_report = get(f"/cases/{c}/report")

    reset(c)
    post(f"/cases/{c}/connections", {"source": innocent, "target": "L01"})
    post(f"/cases/{c}/connections", {"source": innocent, "target": "L02"})
    search_free_spot(c, spot)
    reasoned = post(f"/cases/{c}/conclusion", {"suspectId": innocent, "evidenceIds": [spot["e"]]})
    reset(c)
    desk_reset = next(x for x in get("/cases").body if x["id"] == c)

    shape_eq = sorted(thin.body.keys()) == sorted(wrong_thin.body.keys())
    wh1 = report.body["ending"]["whatHappened"]
    wh2 = wrong_report.body["ending"]["whatHappened"]
    record(f"EC-33.{c}", f"[{c}] Right name on thin evidence -> criminal_escapes, deduped cites, same shape as a wrong name; no whatHappened",
           thin.status == 200 and thin.body["ending"] == "criminal_escapes" and len(thin.body["evidenceIds"]) == 1
           and shape_eq and wh1 is None and wh2 is None,
           f"culprit+thin -> {thin.body['ending']}, cites={len(thin.body['evidenceIds'])}; innocent+thin -> {wrong_thin.body['ending']}; "
           f"keys equal: {shape_eq}; whatHappened: {wh1} / {wh2}")
    record(f"EC-34.{c}", f"[{c}] Second accusation -> 422; desk shows closed + ending; reset puts desk back to 'new'",
           second.status == 422 and desk["status"] == "closed" and (desk.get("ending") or {}).get("id") == "criminal_escapes"
           and desk_reset["status"] == "new",
           f"second -> {second.status}; desk={desk['status']}/{(desk.get('ending') or {}).get('id')}; after reset={desk_reset['status']}")
    record(f"EC-35.{c}", f"[{c}] Innocent with >=2 board links -> wrong_suspect; with nothing -> innocent_accused",
           reasoned.body["ending"] == "wrong_suspect" and wrong_thin.body["ending"] == "innocent_accused",
           f"2 links -> {reasoned.body['ending']}; no support -> {wrong_thin.body['ending']}")
    if c == "047":
        changed = report.body["connections"] != report2.body["connections"] or report.body["theory"] != report2.body["theory"]
        record("EC-36", "After the case is closed the board, theory and viewed state should be frozen",
               after_close["link"] != 201 and after_close["theory"] != 200 and not changed,
               f"after close: new link -> {after_close['link']}, theory edit -> {after_close['theory']}, "
               f"viewed -> {after_close['viewed']}, travel -> {after_close['travel']}; report changed after close: {changed}")

# ================================================================ H. assistant & notes

c = "047"
reset(c)
aq = lambda q: post(f"/cases/{c}/assistant/query", {"question": q})
ok, obs = matrix([
    ("empty", aq(""), 400),
    ("whitespace", aq("   \n "), 400),
    ("500 chars", aq("a" * 500), 200),
    ("501 chars", aq("a" * 501), 400),
    ("number", aq(5), 400),
])
record("EC-37", "Assistant question length/type boundaries (1-500 chars, whitespace-only rejected)", ok, obs)

r = aq("what happened between 25:00 and 26:99?")
record("EC-38", "Impossible clock times fall back to the low-confidence help answer (no 500)",
       r.status == 200 and r.body.get("confidence") == "low", st(r))

r = aq("who (lied? [about] *everything* +\\")
record("EC-39", "Regex metacharacters in a question do not crash the classifier", r.status == 200, st(r))

notes = lambda body: post(f"/cases/{c}/notes", body)
ok, obs = matrix([
    ("unknown prompt", notes({"promptId": "nope"}), 404),
    ("statement:S99", notes({"promptId": "statement:S99"}), 404),
    ("unlisted window", notes({"promptId": "window:03:00-03:30"}), 404),
    ("connect same twice", notes({"promptId": "connect", "items": ["S01", "S01"]}), 400),
    ("connect 3 items", notes({"promptId": "connect", "items": ["S01", "S02", "S03"]}), 400),
    ("connect locked E", notes({"promptId": "connect", "items": ["E001", "S01"]}), 400),
    ("no promptId", notes({}), 400),
])
record("EC-40", "Detective's Notes validation (unknown prompt/suspect/window 404; bad connect picks 400)", ok, obs)

hidden_t = next(t for t in load(c, "timeline") if t["evidenceIds"])
leak = notes({"promptId": "connect", "items": [hidden_t["id"], "S01"]})
leaked = hidden_t["title"] in dump(leak.body)
answer = leak.body.get("answer", "") if isinstance(leak.body, dict) else ""
record("EC-41", "Notes 'connect' must reject a timeline event the player has not uncovered",
       leak.status == 400 and not leaked,
       f"{hidden_t['id']} (locked) -> {leak.status}; hidden event title in answer: {leaked} -> \"{answer[:120]}\"")

c = "050"
reset(c)
unlock_by_search(c, "E005")
prompts = [p["id"] for p in get(f"/cases/{c}/notes").body if p["id"].startswith("window:")]
w = next((p for p in prompts if p.startswith("window:23:30")), None)
r = post(f"/cases/{c}/notes", {"promptId": w}) if w else None
rb = r.body if r else {}
record("EC-42", "050: the 23:30 half-hour window must return the 23:45 event (T05), not the rest of the day",
       bool(r) and "T05" in rb.get("relatedEvents", []) and not re.search(r"Between 00:00", rb.get("answer", "")),
       f"windows offered={prompts}; {w} -> \"{rb.get('answer', '')[:140]}\" relatedEvents={rb.get('relatedEvents')}")

tl, inc = load(c, "timeline"), load(c, "case")["incidentWindow"]
off_day = [t["id"] for t in tl if t["timestamp"][:10] != inc["from"][:10] and inc["from"] <= t["timestamp"] <= inc["to"]]
windows_all = []
reset(c)
for t in tl:
    for ev in t["evidenceIds"]:
        try:
            unlock_by_search(c, ev)
        except RuntimeError:
            pass
windows_all = [p["id"] for p in get(f"/cases/{c}/notes").body if p["id"].startswith("window:")]
covered = [tid for tid in off_day
           if any(w_.split(":", 1)[1].startswith(next(t for t in tl if t["id"] == tid)["timestamp"][11:13]) for w_ in windows_all)]
record("EC-43", "Events inside the incident window but after midnight (050) should get a half-hour window prompt once uncovered",
       len(covered) == len(off_day),
       f"incident window {inc['from']} -> {inc['to']}; next-day events: {off_day}; windows offered: {windows_all}")
reset(c)

# ================================================================ I. static data integrity

out, ok = [], True
for c in CASES:
    s, l, e = len(load(c, "suspects")), len(load(c, "locations")), len(load(c, "evidence"))
    ok = ok and s == 5 and l == 6 and 14 <= e <= 18
    out.append(f"{c}: {s}p/{l}L/{e}E")
record("EC-44", "Every case matches the README: 5 people, 6 places, 14-18 exhibits", ok, "; ".join(out))

hits = []
for c in CASES:
    txt = dump(load(c, "endings"))
    culprit = next(x for x in load(c, "suspects") if x["id"] == load(c, "solution")["culprit"])
    if culprit["name"] in txt:
        hits.append(c)
record("EC-45", "No endings.json names the culprit (checked without printing the key)", not hits, ", ".join(hits) or "0 hits")

bad = []
for c in CASES:
    sol = load(c, "solution")
    ev = {x["id"] for x in load(c, "evidence")}
    ids = ev | {x["id"] for x in load(c, "suspects")} | {x["id"] for x in load(c, "timeline")} \
        | {x["id"] for x in load(c, "locations")} | {a["id"] for s in load(c, "statements") for a in s["assertions"]}
    if not all(i in ev for i in sol["requiredEvidence"]): bad.append(f"{c} requiredEvidence")
    if not all(i in ids for pair in sol["requiredConnections"] for i in pair): bad.append(f"{c} requiredConnections")
    if not any(x["id"] == sol["culprit"] for x in load(c, "suspects")): bad.append(f"{c} culprit")
record("EC-46", "Every answer key only refers to IDs that exist in its own case", not bad, ", ".join(bad) or "all 5 keys consistent")

lockable = []
for c in CASES:
    routes = {}
    add = lambda i, req: routes.setdefault(i, []).append(req)
    for p in load(c, "case")["file"]:
        for i in p.get("attachments") or []:
            add(i, None)
    for l in load(c, "locations"):
        for sp in l.get("spots") or []:
            for q in sp.get("consequences") or []:
                if q["type"] == "unlock_evidence":
                    add(q["evidenceId"], sp.get("requires"))
    for t in load(c, "dialogue")["interviews"].values():
        for node in t["nodes"].values():
            for ch in node["choices"]:
                for q in ch.get("consequences") or []:
                    if q["type"] == "unlock_evidence":
                        add(q["evidenceId"], ch.get("requires"))
    neg = lambda req: bool(req) and any("ne" in cond for cond in (req.get("flags") or {}).values())
    lockable += [f"{c}:{i}" for i, rs in routes.items() if all(neg(x) for x in rs)]
record("EC-47", "Evidence whose every unlock route can be shut by a bad interview choice (a 'ne' flag)",
       not lockable, f"can be locked out: {', '.join(lockable)}" if lockable else "none")

c = "051"
reset(c)
home = where_is(c, "S03")
post(f"/cases/{c}/travel", {"locationId": home})
acc = post(f"/cases/{c}/dialogue/S03/choice", {"choiceId": "sb-start-accuse"})
d = get(f"/cases/{c}/dialogue/S03").body
lv = next((x for x in d["choices"] if x["leaves"] or x["id"].endswith("back")), None)
if lv:
    post(f"/cases/{c}/dialogue/S03/choice", {"choiceId": lv["id"]})
unlock_by_search(c, "E005")
post(f"/cases/{c}/travel", {"locationId": home})
cur = get(f"/cases/{c}/dialogue/S03").body
pres = post(f"/cases/{c}/dialogue/S03/choice", {"presentEvidenceId": "E005"})
has = "E006" in inv(c)["unlockedEvidence"]
reaction = (pres.body.get("presented") or {}).get("reaction") if isinstance(pres.body, dict) else None
record("EC-48", "051: after 'Accuse him of poisoning Gerald with foxglove' (S03 hostile), E006 must still be obtainable",
       has, f"accuse -> {acc.status}; later present E005 at node {cur['nodeId']} -> {pres.status} reaction={reaction}; E006 unlocked: {has}")
reset(c)

# ================================================================ summary

passed = sum(r["pass"] for r in results)
print(f"\n{passed}/{len(results)} pass")
failed = [r["id"] for r in results if not r["pass"]]
if failed:
    print("Failed: " + ", ".join(failed))
if args.json:
    with open(args.json, "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2, ensure_ascii=False)
sys.exit(0 if not failed else 1)
