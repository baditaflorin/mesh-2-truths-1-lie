import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

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
