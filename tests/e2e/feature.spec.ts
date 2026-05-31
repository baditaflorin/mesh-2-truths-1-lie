import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

const A_STATEMENTS = ["I once met a llama", "I have been to Mars", "I can juggle"] as const;
// Peer A marks statement 2 ("I have been to Mars") as the lie.
const A_LIE_TEXT = A_STATEMENTS[1];

test("submit form shows on both peers; both commit independently", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");

    // Submit 3 statements from peer A
    await a.getByPlaceholder("statement 1").fill("I have a cat");
    await a.getByPlaceholder("statement 2").fill("I have been to Mars");
    await a.getByPlaceholder("statement 3").fill("I can juggle");
    await a.getByRole("button", { name: "commit" }).click();

    // Peer A now sees the committed state
    await expect(a.getByText(/committed/)).toBeVisible();
    // Peer B still sees the form
    await expect(b.getByPlaceholder("statement 1")).toBeVisible();
  } finally {
    await cleanup();
  }
});

/**
 * Load-bearing cross-peer assertion for the advertised core action:
 * "commit-reveal so others can't peek before the deadline".
 *
 * Drives the full advertised flow on the OPPOSITE peer:
 *   1. Both peers commit → A's commit must propagate to B (the gate appears on B).
 *   2. PRIVACY: before reveal, B must NOT be able to read A's plaintext lie —
 *      only the SHA-256 commitment crosses the mesh. This is the headline claim.
 *   3. After A reveals, B can finally read A's statements, vote, and in results
 *      see the lie correctly unmasked — proving the reveal propagated A→B.
 */
test("commit hides A's lie from B until reveal, then B sees it and the lie is unmasked", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");

    // Peer A: mark statement 2 as the lie, then fill + commit.
    await a.getByRole("radio").nth(1).check();
    await a.getByPlaceholder("statement 1").fill(A_STATEMENTS[0]);
    await a.getByPlaceholder("statement 2").fill(A_STATEMENTS[1]);
    await a.getByPlaceholder("statement 3").fill(A_STATEMENTS[2]);
    await a.getByRole("button", { name: "commit" }).click();
    await expect(a.getByText(/committed/)).toBeVisible();

    // PRIVACY ASSERTION: A has committed but not revealed. B must not be able
    // to read A's plaintext statements anywhere in the DOM — only the hash
    // commitment has crossed the mesh. A flashy-but-fake build that synced the
    // plaintext early (or skipped the commit step) would leak the lie here.
    await expect(b.getByText(A_LIE_TEXT)).toHaveCount(0);
    await expect(b.getByText(A_STATEMENTS[0])).toHaveCount(0);

    // Peer B commits its own entry.
    await b.getByPlaceholder("statement 1").fill("I run marathons");
    await b.getByPlaceholder("statement 2").fill("I own a dragon");
    await b.getByPlaceholder("statement 3").fill("I bake bread");
    await b.getByRole("button", { name: "commit" }).click();

    // CROSS-PEER GATE: A's commit reached B (and vice versa), so BOTH peers now
    // surface the "everyone committed → reveal" control. This fails if commits
    // are written to React state instead of the Yjs doc.
    const revealBtn = (p: typeof a) => p.getByRole("button", { name: /everyone committed/i });
    await expect(revealBtn(a)).toBeVisible();
    await expect(revealBtn(b)).toBeVisible();

    // Peer A reveals → moves the room into the vote phase.
    await revealBtn(a).click();

    // Now (and only now) B can read A's previously-hidden statements. This is
    // the reveal half of commit-reveal propagating A→B over the mesh.
    await expect(b.getByText(A_STATEMENTS[0])).toBeVisible();
    await expect(b.getByText(A_LIE_TEXT)).toBeVisible();
    await expect(b.getByText(A_STATEMENTS[2])).toBeVisible();

    // Peer B was pulled into the vote phase by A's "start voting" click before
    // B had opened its own commitment. B must still be able to reveal — this is
    // the late-revealer path that previously deadlocked the room.
    await expect(b.getByRole("button", { name: /reveal my statements/i })).toBeVisible();
    await b.getByRole("button", { name: /reveal my statements/i }).click();

    // With every player revealed, "show results" unlocks on B and advances.
    await expect(b.getByRole("button", { name: /show results/i })).toBeVisible();
    await b.getByRole("button", { name: /show results/i }).click();

    // RESULTS CROSS-PEER ASSERTION: on B's screen, A's lie is the statement
    // tagged "← the lie". The lieIdx only became readable after A's reveal, so
    // this proves the private commitment opened correctly across the mesh.
    const aCard = b.locator(".ttl-card", { hasText: "alice" });
    await expect(aCard.locator(".ttl-stmt.is-lie")).toContainText(A_LIE_TEXT);
    await expect(aCard.locator(".ttl-stmt.is-lie")).toContainText("← the lie");
    // And the truths are NOT tagged as the lie.
    await expect(aCard.locator(".ttl-stmt.is-truth")).toHaveCount(2);
  } finally {
    await cleanup();
  }
});
