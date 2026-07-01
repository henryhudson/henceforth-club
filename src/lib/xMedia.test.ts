import { describe, it, expect } from "vitest";
import { extractMediaRefs, bestVideoVariant, imageContentType } from "./xMedia";

const tweets = {
  data: [
    { id: "p1", text: "a", attachments: { media_keys: ["m_img"] } },
    { id: "p2", text: "b", attachments: { media_keys: ["m_vid"] } },
    { id: "p3", text: "c" }, // no media
  ],
  includes: {
    media: [
      { media_key: "m_img", type: "photo", url: "https://pbs.twimg.com/media/AbC.jpg" },
      { media_key: "m_vid", type: "video", variants: [
        { bit_rate: 256000,  content_type: "video/mp4", url: "https://video.twimg.com/lo.mp4" },
        { bit_rate: 2176000, content_type: "video/mp4", url: "https://video.twimg.com/hi.mp4" },
        { content_type: "application/x-mpegURL", url: "https://video.twimg.com/x.m3u8" },
      ] },
    ],
  },
};

describe("extractMediaRefs", () => {
  it("maps a photo to its full-res url with an inferred content-type", () => {
    expect(extractMediaRefs(tweets)).toContainEqual(
      { postId: "p1", contentType: "image/jpeg", url: "https://pbs.twimg.com/media/AbC.jpg" });
  });
  it("maps a video to its highest-bitrate mp4 variant", () => {
    expect(extractMediaRefs(tweets)).toContainEqual(
      { postId: "p2", contentType: "video/mp4", url: "https://video.twimg.com/hi.mp4" });
  });
  it("emits nothing for a post with no media", () => {
    expect(extractMediaRefs(tweets).some((r) => r.postId === "p3")).toBe(false);
  });
});

describe("bestVideoVariant", () => {
  it("picks the highest bit_rate mp4, ignoring non-mp4", () => {
    expect(bestVideoVariant([
      { content_type: "application/x-mpegURL", url: "x.m3u8" },
      { bit_rate: 1, content_type: "video/mp4", url: "lo" },
      { bit_rate: 9, content_type: "video/mp4", url: "hi" },
    ])).toBe("hi");
  });
  it("returns undefined when there is no mp4", () => {
    expect(bestVideoVariant([{ content_type: "application/x-mpegURL", url: "x" }])).toBeUndefined();
  });
});

describe("imageContentType", () => {
  it("infers from the extension, defaulting to jpeg", () => {
    expect(imageContentType("https://pbs.twimg.com/media/A.png")).toBe("image/png");
    expect(imageContentType("https://pbs.twimg.com/media/A.jpg")).toBe("image/jpeg");
    expect(imageContentType("https://pbs.twimg.com/media/A")).toBe("image/jpeg");
  });
});
