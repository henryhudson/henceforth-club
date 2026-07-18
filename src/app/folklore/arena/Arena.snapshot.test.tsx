import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ArenaPage from "./page";
import { ArenaView, type WireDeal } from "./Arena";

const deal: WireDeal = {
  token: "tok-1",
  pair: [
    { postId: "p1", author: "ann", text: "The first text, dealt on top." },
    { postId: "p2", author: "ben", text: "The second text, stacked beneath." },
  ],
};

afterEach(() => vi.unstubAllEnvs());

describe("/folklore/arena — the page gate", () => {
  it("is a quiet not-found while KUDOS_ENABLED is not exactly \"true\"", () => {
    vi.stubEnv("KUDOS_ENABLED", "");
    expect(() => ArenaPage()).toThrow();

    vi.stubEnv("KUDOS_ENABLED", "1");
    expect(() => ArenaPage()).toThrow();
  });

  it("deals the arena once the flag is on", () => {
    vi.stubEnv("KUDOS_ENABLED", "true");
    const html = renderToStaticMarkup(ArenaPage());
    expect(html).toContain("arena");
  });
});

describe("ArenaView", () => {
  it("stacks the dealt pair with the shared kudos control on each text and NO vote buttons", () => {
    const html = renderToStaticMarkup(
      <ArenaView phase={{ kind: "live", deal, crownedPostId: null }} float={1997} />,
    );
    expect(html).toContain("The first text, dealt on top.");
    expect(html).toContain("The second text, stacked beneath.");
    expect(html.match(/give kudos/g)?.length).toBe(2);
    expect(html).not.toMatch(/vote/i);
    expect(html).toContain("1,997");
    expect(html).toMatchSnapshot();
  });

  it("crowns the first-kudos side and quiets the other control", () => {
    const html = renderToStaticMarkup(
      <ArenaView phase={{ kind: "live", deal, crownedPostId: "p1" }} float={1994} />,
    );
    expect(html).toContain("crowned");
    expect(html.match(/disabled=""/g)?.length).toBe(1);
  });

  it("shows a visitor the disabled state with the £2 nudge", () => {
    const html = renderToStaticMarkup(<ArenaView phase={{ kind: "visitor" }} float={null} />);
    expect(html).toContain("£2");
    expect(html).toMatchSnapshot();
  });

  it("says plainly when the pool cannot put up two texts", () => {
    const html = renderToStaticMarkup(<ArenaView phase={{ kind: "empty" }} float={null} />);
    expect(html).toMatch(/two texts/i);
  });
});
