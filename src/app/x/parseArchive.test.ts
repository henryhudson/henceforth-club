import { describe, it, expect } from "vitest";
import { parseArchive } from "./parseArchive";

const tweetsJS = `window.YTD.tweets.part0 = [
  { "tweet" : { "id_str" : "1001", "created_at" : "Wed Oct 10 20:19:24 +0000 2018", "full_text" : "hello world" } },
  { "tweet" : { "id_str" : "1002", "created_at" : "Thu Oct 11 09:00:00 +0000 2018", "full_text" : "@friend good point", "in_reply_to_status_id_str" : "999", "in_reply_to_screen_name" : "friend" } }
]`;

const profileJS = `window.YTD.profile.part0 = [
  { "profile" : { "description" : { "bio" : "builder of things", "website" : "https://example.com", "location" : "London" }, "avatarMediaUrl" : "https://pbs.twimg.com/x.jpg" } }
]`;

const accountJS = `window.YTD.account.part0 = [
  { "account" : { "username" : "henry", "accountId" : "42", "createdAt" : "2016-01-01T00:00:00.000Z", "accountDisplayName" : "Henry H" } }
]`;

describe("parseArchive", () => {
  it("strips the JS wrapper and decodes tweets", () => {
    const a = parseArchive(tweetsJS, profileJS, accountJS);
    expect(a.posts).toHaveLength(2);
    expect(a.posts[0].id).toBe("1001");
    expect(a.posts[0].text).toBe("hello world");
  });

  it("maps the profile and handle", () => {
    const a = parseArchive(tweetsJS, profileJS, accountJS);
    expect(a.profile.handle).toBe("henry");
    expect(a.profile.displayName).toBe("Henry H");
    expect(a.profile.bio).toBe("builder of things");
    expect(a.profile.location).toBe("London");
  });

  it("keeps the @username a reply was directed to", () => {
    const a = parseArchive(tweetsJS, profileJS, accountJS);
    expect(a.posts[0].replyToScreenName).toBeUndefined();
    expect(a.posts[1].replyToScreenName).toBe("friend");
    expect(a.posts[1].replyToId).toBe("999");
  });

  it("parses an empty tweet set but still reads the handle", () => {
    const a = parseArchive("window.YTD.tweets.part0 = [ ]", profileJS, accountJS);
    expect(a.posts).toHaveLength(0);
    expect(a.profile.handle).toBe("henry");
  });

  it("throws on a malformed export", () => {
    expect(() => parseArchive("not json at all", profileJS, accountJS)).toThrow();
  });
});
