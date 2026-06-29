import type { XArchive } from "../parseArchive";

function formatDate(s?: string): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

// Declared at module scope (not inside ProfileView's render) so it isn't
// re-created — and its state reset — on every render. Takes what it needs as props.
function Avatar({
  size,
  avatarUrl,
  initial,
}: {
  size: number;
  avatarUrl?: string;
  initial: string;
}) {
  return avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt=""
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="flex items-center justify-center rounded-full bg-accent/15 font-bold text-accent"
      style={{ width: size, height: size }}
    >
      {initial}
    </div>
  );
}

export default function ProfileView({ archive }: { archive: XArchive }) {
  const { profile, posts } = archive;
  const initial = (profile.displayName || profile.handle || "?").charAt(0).toUpperCase();

  // Each unique text shown once: drop duplicate posts, and only quote a parent
  // whose text isn't already shown (as a post, or as an earlier parent).
  const seenPost = new Set<string>();
  const uniquePosts = posts.filter((p) => {
    const k = p.text.trim();
    if (seenPost.has(k)) return false;
    seenPost.add(k);
    return true;
  });
  const postTexts = new Set(uniquePosts.map((p) => p.text.trim()));
  const shownParent = new Set<string>();
  const showParentFor = uniquePosts.map((p) => {
    if (!p.parent) return false;
    const k = p.parent.text.trim();
    if (postTexts.has(k) || shownParent.has(k)) return false;
    shownParent.add(k);
    return true;
  });

  return (
    <div className="mx-auto max-w-2xl px-6 pb-24">
      {/* Header */}
      <div className="rounded-2xl border border-card-border bg-card-bg p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <Avatar size={64} avatarUrl={profile.avatarUrl} initial={initial} />
          <div>
            <h2 className="text-xl font-bold text-foreground">{profile.displayName ?? profile.handle}</h2>
            <p className="text-accent">@{profile.handle}</p>
          </div>
        </div>
        {profile.bio && <p className="mt-4 text-foreground/90">{profile.bio}</p>}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
          {profile.location && <span>{profile.location.trim()}</span>}
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              {profile.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          {profile.createdAt && <span>Joined {formatDate(profile.createdAt)}</span>}
          <span>{uniquePosts.length} posts shown</span>
        </div>
      </div>

      {/* Feed — newest first, linear */}
      <div className="mt-6 space-y-3">
        {uniquePosts.map((p, i) => (
          <article key={p.id} className="rounded-xl border border-card-border bg-card-bg p-4">
            {/* The tweet being replied to */}
            {showParentFor[i] && p.parent ? (
              <div className="mb-3 rounded-lg border-l-2 border-card-border-hover bg-background/40 px-3 py-2">
                <p className="text-xs font-semibold text-accent">@{p.parent.author}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{p.parent.text}</p>
              </div>
            ) : p.replyToScreenName ? (
              <p className="mb-2 text-xs text-muted">
                ↳ replying to <span className="text-accent">@{p.replyToScreenName}</span>
              </p>
            ) : null}

            {/* The post */}
            <div className="flex gap-3">
              <div className="shrink-0">
                <Avatar size={40} avatarUrl={profile.avatarUrl} initial={initial} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-bold text-foreground">{profile.displayName ?? profile.handle}</span>{" "}
                  <span className="text-muted">@{profile.handle} · {formatDate(p.at)}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/95">{p.text}</p>
                {p.media && p.media.length > 0 && (
                  <div className={`mt-3 grid gap-2 ${p.media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {p.media.map((m, i) =>
                      m.type === "photo" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={m.url} alt="" className="w-full rounded-lg border border-card-border object-cover" />
                      ) : (
                        <video
                          key={i}
                          src={m.url}
                          poster={m.preview}
                          controls
                          playsInline
                          className="w-full rounded-lg border border-card-border"
                        />
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
