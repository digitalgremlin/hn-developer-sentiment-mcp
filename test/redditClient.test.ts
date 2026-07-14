import { describe, it, expect, vi } from "vitest";
import { normalizeListing, RedditClient, RedditRateLimitError } from "../src/redditClient.js";

const tokenOk = () => ({ ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) });
const baseOpts = { clientId: "id", clientSecret: "sec", clock: () => 0 };

const listing = {
  data: { children: [
    { kind: "t3", data: { name: "t3_a", id: "a", title: "Hi", selftext: "body", subreddit: "WebDev",
              score: 5, num_comments: 2, permalink: "/r/webdev/comments/a/hi/", created_utc: 1000 } },
  ] },
};

describe("normalizeListing", () => {
  it("maps reddit fields to RawPost", () => {
    const [p] = normalizeListing(listing);
    expect(p).toEqual({ id: "t3_a", title: "Hi", selftext: "body", subreddit: "webdev",
      score: 5, numComments: 2, permalink: "/r/webdev/comments/a/hi/", createdUtc: 1000 });
  });
});

describe("RedditClient", () => {
  it("fetches a token once, then searches with bearer auth", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => listing });
    const c = new RedditClient({ clientId: "id", clientSecret: "sec", fetchFn: fetchMock as any, clock: () => 0 });
    const { posts } = await c.search("react", ["webdev", "programming"], "month", 100);
    expect(posts).toHaveLength(1);
    const url = (fetchMock.mock.calls[1][0] as string);
    expect(url).toContain("/r/webdev+programming/search");
    expect(url).toContain("restrict_sr=1");
  });
});

describe("RedditClient transient retry", () => {
  it("retries a transient 5xx then succeeds (with injected sleep, no real wait)", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => listing });
    const sleep = vi.fn(async () => {});
    const c = new RedditClient({ ...baseOpts, fetchFn: fetchMock as any, sleepFn: sleep });
    const { posts } = await c.search("react", ["webdev"], "month", 100);
    expect(posts).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3); // token + 503 + retried 200
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("retries on a network error then succeeds", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenOk())
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => listing });
    const sleep = vi.fn(async () => {});
    const c = new RedditClient({ ...baseOpts, fetchFn: fetchMock as any, sleepFn: sleep });
    const { posts } = await c.search("react", ["webdev"], "month", 100);
    expect(posts).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry on 429 (surfaces RedditRateLimitError)", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    const sleep = vi.fn(async () => {});
    const c = new RedditClient({ ...baseOpts, fetchFn: fetchMock as any, sleepFn: sleep });
    await expect(c.search("react", ["webdev"], "month", 100)).rejects.toBeInstanceOf(RedditRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(2); // token + one 429, no retry
    expect(sleep).not.toHaveBeenCalled();
  });

  it("gives up after maxRetries on persistent 5xx", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    const sleep = vi.fn(async () => {});
    const c = new RedditClient({ ...baseOpts, fetchFn: fetchMock as any, sleepFn: sleep, maxRetries: 2 });
    await expect(c.search("react", ["webdev"], "month", 100)).rejects.toThrow(/Reddit request failed \(503\)/);
    expect(fetchMock).toHaveBeenCalledTimes(4); // token + 3 search attempts (1 + 2 retries)
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});

const aboutOk = () => ({ ok: true, status: 200, json: async () => ({ kind: "t5", data: {} }) });
const notFound = () => ({ ok: false, status: 404, json: async () => ({}) });

describe("RedditClient bad-subreddit retry (spec §6)", () => {
  it("drops a not-found subreddit and retries the search with the survivors", async () => {
    // token -> combined 404 -> about(webdev) ok -> about(notarealsub) 404 -> retried search ok
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(aboutOk())
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => listing });
    const c = new RedditClient({ ...baseOpts, fetchFn: fetchMock as any });
    const result = await c.search("react", ["webdev", "notarealsub"], "month", 100);
    expect(result.posts).toHaveLength(1);
    expect(result.droppedSubreddits).toEqual(["notarealsub"]);
    // the retry must target only the surviving sub, never the bad one
    const retryUrl = fetchMock.mock.calls[4][0] as string;
    expect(retryUrl).toContain("/r/webdev/search");
    expect(retryUrl).not.toContain("notarealsub");
  });

  it("reports no drops on a clean search", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => listing });
    const c = new RedditClient({ ...baseOpts, fetchFn: fetchMock as any });
    const result = await c.search("react", ["webdev", "programming"], "month", 100);
    expect(result.posts).toHaveLength(1);
    expect(result.droppedSubreddits).toEqual([]);
  });

  it("does NOT probe/retry when only one subreddit was requested (nothing to salvage)", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(notFound());
    const c = new RedditClient({ ...baseOpts, fetchFn: fetchMock as any });
    await expect(c.search("react", ["webdev"], "month", 100)).rejects.toThrow(/Reddit request failed \(404\)/);
    expect(fetchMock).toHaveBeenCalledTimes(2); // token + the single 404, no /about probes
  });

  it("throws the original error when every requested subreddit is invalid", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(notFound()) // combined search 404
      .mockResolvedValueOnce(notFound()) // about(bad1)
      .mockResolvedValueOnce(notFound()); // about(bad2)
    const c = new RedditClient({ ...baseOpts, fetchFn: fetchMock as any });
    await expect(c.search("react", ["bad1", "bad2"], "month", 100)).rejects.toThrow(/Reddit request failed \(404\)/);
  });

  it("rethrows when the 404 was not caused by a bad subreddit (all probes valid)", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(notFound()) // combined search 404
      .mockResolvedValueOnce(aboutOk())  // about(webdev) ok
      .mockResolvedValueOnce(aboutOk()); // about(programming) ok
    const c = new RedditClient({ ...baseOpts, fetchFn: fetchMock as any });
    await expect(c.search("react", ["webdev", "programming"], "month", 100)).rejects.toThrow(/Reddit request failed \(404\)/);
  });

  it("drops a not-found subreddit on top() as well", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(aboutOk())
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => listing });
    const c = new RedditClient({ ...baseOpts, fetchFn: fetchMock as any });
    const result = await c.top(["webdev", "notarealsub"], "month", 100);
    expect(result.posts).toHaveLength(1);
    expect(result.droppedSubreddits).toEqual(["notarealsub"]);
    const retryUrl = fetchMock.mock.calls[4][0] as string;
    expect(retryUrl).toContain("/r/webdev/top");
  });
});
