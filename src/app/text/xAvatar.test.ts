import { describe, it, expect } from "vitest";
import { fullResXAvatar } from "./xAvatar";

describe("fullResXAvatar", () => {
  it("upgrades the default _normal profile thumbnail to the original", () => {
    expect(fullResXAvatar("https://pbs.twimg.com/profile_images/123/avatar_normal.jpg"))
      .toBe("https://pbs.twimg.com/profile_images/123/avatar.jpg");
  });

  it("upgrades other size suffixes (_bigger, _200x200)", () => {
    expect(fullResXAvatar("https://pbs.twimg.com/profile_images/123/a_bigger.png"))
      .toBe("https://pbs.twimg.com/profile_images/123/a.png");
    expect(fullResXAvatar("https://pbs.twimg.com/profile_images/123/a_200x200.jpg"))
      .toBe("https://pbs.twimg.com/profile_images/123/a.jpg");
  });

  it("upgrades the ?name= query variant to orig", () => {
    expect(fullResXAvatar("https://pbs.twimg.com/media/abc?format=jpg&name=small"))
      .toBe("https://pbs.twimg.com/media/abc?format=jpg&name=orig");
  });

  it("passes an already-original url and undefined straight through", () => {
    expect(fullResXAvatar("https://pbs.twimg.com/profile_images/123/a.jpg"))
      .toBe("https://pbs.twimg.com/profile_images/123/a.jpg");
    expect(fullResXAvatar(undefined)).toBeUndefined();
  });

  it("is idempotent — upgrading an upgraded url changes nothing", () => {
    const once = fullResXAvatar("https://pbs.twimg.com/profile_images/123/avatar_normal.jpg");
    expect(fullResXAvatar(once)).toBe(once);
  });
});
