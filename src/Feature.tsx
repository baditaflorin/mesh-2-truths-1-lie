import { useEffect, useRef, useState } from "react";
import {
  commit,
  MeshNameInput,
  randomSalt,
  verifyReveal,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Phase = "submit" | "vote" | "results";
type Submission = {
  statements: [string, string, string];
  /** Index of the lie (0/1/2) — kept private until reveal. */
  lieIdx: number;
};
type Player = { id: string; name: string };

const NAME_KEY = (prefix: string) => `${prefix}:displayName`;

export function Feature({ room, config }: Props) {
  const [name, setName] = useState(
    () => localStorage.getItem(NAME_KEY(config.storagePrefix)) ?? "",
  );
  const [draft, setDraft] = useState<[string, string, string]>(["", "", ""]);
  const [draftLie, setDraftLie] = useState(0);
  const [, rerender] = useState(0);
  const myEntryRef = useRef<{ submission: Submission; salt: string } | null>(null);

  useEffect(() => {
    if (name) localStorage.setItem(NAME_KEY(config.storagePrefix), name);
  }, [name, config.storagePrefix]);

  useEffect(() => {
    if (!room) return;
    const yPlayers = room.doc.getMap<Player>("players");
    const yCommits = room.doc.getMap<{ hash: string }>("commits");
    const yReveals = room.doc.getMap<{ salt: string; payload: string }>("reveals");
    const yVotes = room.doc.getMap<Record<string, number>>("votes");
    const yPhase = room.doc.getMap<{ phase: Phase }>("phase");
    const onChange = () => rerender((n) => n + 1);
    yPlayers.observe(onChange);
    yCommits.observe(onChange);
    yReveals.observe(onChange);
    yVotes.observe(onChange);
    yPhase.observe(onChange);
    return () => {
      yPlayers.unobserve(onChange);
      yCommits.unobserve(onChange);
      yReveals.unobserve(onChange);
      yVotes.unobserve(onChange);
      yPhase.unobserve(onChange);
    };
  }, [room]);

  useEffect(() => {
    if (!room) return;
    const myName = name.trim() || `peer-${room.peerId.slice(0, 4)}`;
    room.doc.getMap<Player>("players").set(room.peerId, { id: room.peerId, name: myName });
  }, [room, name]);

  if (!room) {
    return (
      <div className="ttl-screen">
        <h1>two truths &amp; a lie</h1>
        <p className="ttl-status">Connecting…</p>
      </div>
    );
  }

  const yPlayers = room.doc.getMap<Player>("players");
  const yCommits = room.doc.getMap<{ hash: string }>("commits");
  const yReveals = room.doc.getMap<{ salt: string; payload: string }>("reveals");
  const yVotes = room.doc.getMap<Record<string, number>>("votes");
  const yPhase = room.doc.getMap<{ phase: Phase }>("phase");

  const phase: Phase = yPhase.get("current")?.phase ?? "submit";
  const players: Player[] = [];
  yPlayers.forEach((p) => players.push(p));
  players.sort((a, b) => a.id.localeCompare(b.id));

  const submit = async () => {
    if (!draft.every((s) => s.trim().length > 0)) return;
    if (yCommits.has(room.peerId)) return;
    const submission: Submission = {
      statements: [draft[0].trim(), draft[1].trim(), draft[2].trim()],
      lieIdx: draftLie,
    };
    const payload = JSON.stringify(submission);
    const salt = randomSalt();
    const { hash } = await commit(payload, salt);
    yCommits.set(room.peerId, { hash });
    myEntryRef.current = { submission, salt };
  };

  const reveal = () => {
    if (!myEntryRef.current) return;
    if (yReveals.has(room.peerId)) return;
    yReveals.set(room.peerId, {
      salt: myEntryRef.current.salt,
      payload: JSON.stringify(myEntryRef.current.submission),
    });
    yPhase.set("current", { phase: "vote" });
  };

  const vote = (targetId: string, idx: number) => {
    const cur = yVotes.get(room.peerId) ?? {};
    yVotes.set(room.peerId, { ...cur, [targetId]: idx });
  };

  const showResults = () => yPhase.set("current", { phase: "results" });

  const restart = () => {
    room.doc.transact(() => {
      yCommits.clear();
      yReveals.clear();
      yVotes.clear();
      yPhase.set("current", { phase: "submit" });
    });
    myEntryRef.current = null;
    setDraft(["", "", ""]);
    setDraftLie(0);
  };

  const allCommitted = players.length >= 2 && players.every((p) => yCommits.has(p.id));
  const allRevealed = players.length >= 2 && players.every((p) => yReveals.has(p.id));

  // Verify and decode revealed entries (only when in vote/results)
  const decoded = new Map<string, Submission>();
  if (phase === "vote" || phase === "results") {
    yReveals.forEach((rv, peerId) => {
      try {
        const submission = JSON.parse(rv.payload) as Submission;
        decoded.set(peerId, submission);
      } catch {
        // skip malformed
      }
    });
  }

  const myCommitted = yCommits.has(room.peerId);

  return (
    <div className="ttl-screen">
      <header className="ttl-header">
        <h1>two truths &amp; a lie</h1>
        <MeshNameInput
          className="ttl-name"
          placeholder="your name"
          value={name}
          onChange={setName}
          maxLength={24}
        />
        <p className="ttl-status">
          phase: <strong>{phase}</strong> · {players.length} player{players.length === 1 ? "" : "s"}
        </p>
      </header>

      {phase === "submit" && (
        <>
          {!myCommitted ? (
            <form
              className="ttl-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {([0, 1, 2] as const).map((i) => (
                <label key={i}>
                  <input
                    type="radio"
                    name="lie"
                    checked={draftLie === i}
                    onChange={() => setDraftLie(i)}
                  />
                  <input
                    value={draft[i]}
                    onChange={(e) => {
                      const next = [...draft] as [string, string, string];
                      next[i] = e.target.value;
                      setDraft(next);
                    }}
                    placeholder={`statement ${i + 1}`}
                    maxLength={140}
                  />
                  <span className={draftLie === i ? "ttl-lie-tag" : ""}>
                    {draftLie === i ? "lie" : "true"}
                  </span>
                </label>
              ))}
              <button type="submit" disabled={!draft.every((s) => s.trim().length > 0)}>
                commit
              </button>
              <p className="ttl-help">
                Your statements are hidden behind a SHA-256 commitment until everyone has submitted.
                Even the host can&apos;t peek at the lie.
              </p>
            </form>
          ) : (
            <p className="ttl-info">
              ✓ committed · waiting for {players.length - yCommits.size} more
            </p>
          )}
          {allCommitted && (
            <button type="button" className="ttl-deal" onClick={reveal}>
              everyone committed → reveal &amp; start voting
            </button>
          )}
        </>
      )}

      {phase === "vote" && (
        <>
          {!allRevealed && (
            <p className="ttl-info">
              waiting on reveals: {yReveals.size}/{players.length}
            </p>
          )}
          <ul className="ttl-cards">
            {players.map((p) => {
              if (p.id === room.peerId) return null;
              const sub = decoded.get(p.id);
              if (!sub) return null;
              const myVote = (yVotes.get(room.peerId) ?? {})[p.id];
              return (
                <li key={p.id} className="ttl-card">
                  <h3>{p.name}</h3>
                  <p className="ttl-help">which one is the lie?</p>
                  {sub.statements.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className={myVote === i ? "is-mine" : ""}
                      onClick={() => vote(p.id, i)}
                    >
                      {s}
                    </button>
                  ))}
                </li>
              );
            })}
          </ul>
          {allRevealed && (
            <button type="button" className="ttl-deal" onClick={showResults}>
              show results
            </button>
          )}
        </>
      )}

      {phase === "results" && (
        <>
          <ul className="ttl-cards">
            {players.map((p) => {
              const sub = decoded.get(p.id);
              if (!sub) return null;
              const tally = [0, 0, 0];
              let voters = 0;
              yVotes.forEach((row, voterId) => {
                if (voterId === p.id) return;
                const idx = row[p.id];
                if (idx === 0 || idx === 1 || idx === 2) {
                  tally[idx]!++;
                  voters++;
                }
              });
              return (
                <li key={p.id} className="ttl-card ttl-result">
                  <h3>{p.name}</h3>
                  {sub.statements.map((s, i) => {
                    const isLie = i === sub.lieIdx;
                    const votes = tally[i] ?? 0;
                    const pct = voters > 0 ? Math.round((votes / voters) * 100) : 0;
                    return (
                      <div key={i} className={`ttl-stmt ${isLie ? "is-lie" : "is-truth"}`}>
                        <span>{s}</span>
                        <span className="ttl-tally">
                          {votes} ({pct}%) {isLie ? "← the lie" : ""}
                        </span>
                      </div>
                    );
                  })}
                </li>
              );
            })}
          </ul>
          <button type="button" className="ttl-deal" onClick={restart}>
            new round
          </button>
        </>
      )}
    </div>
  );
}
