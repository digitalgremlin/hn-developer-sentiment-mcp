import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Actor, log } from 'apify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { parseConfig, withEnvCredentials, ConfigError } from './config.js';
import { parseQueryArgs, parseTrendingArgs, ArgError } from './argParser.js';
import { RedditClient, RedditAuthError, RedditRateLimitError, type QueryResult } from './redditClient.js';
import { TtlLruCache } from './cache.js';
import { windowToBucket, withinWindow } from './windowMap.js';
import { buildSentimentSummary } from './tools/getSentimentSummary.js';
import { buildSearchMentions } from './tools/searchMentions.js';
import { buildTrending } from './tools/getTrendingDiscussions.js';
import { buildFeatureRequests } from './tools/getFeatureRequests.js';
import type { Config, RawPost } from './types.js';

await Actor.init();

const CREDS_MSG = 'redditClientId and redditClientSecret are required. Provide them in the Actor input, or as REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET environment variables (recommended for Standby — they persist across restarts).';

// Standby boots with no INPUT.json, so creds come from REDDIT_CLIENT_ID/SECRET env vars
// (see withEnvCredentials). parseConfig still throws when neither input nor env supplies
// them, so we degrade gracefully: the server boots (readiness probe stays green) and each
// tool returns a clear credential error until valid credentials are provided.
const input = (await Actor.getInput<Record<string, unknown>>()) ?? {};
let cfg: Config | null = null;
let client: RedditClient | null = null;
let bootError: string | null = null;
try {
    // Standby boots with no input → fall back to REDDIT_CLIENT_ID/SECRET env vars.
    cfg = parseConfig(withEnvCredentials(input, process.env));
    client = new RedditClient({ clientId: cfg.redditClientId, clientSecret: cfg.redditClientSecret });
} catch (e) {
    bootError = e instanceof Error ? e.message : 'Invalid actor input';
    log.warning(`Booting without valid config: ${bootError} — tools will return an error until credentials are provided.`);
}

// One raw payload per query, shared across the query tools (LRU + TTL). Clock injected for testability.
const ttlMs = (cfg?.cacheTtlMinutes ?? 20) * 60_000;
const cache = new TtlLruCache<QueryResult>({ capacity: 200, ttlMs, clock: () => Date.now() });

function nowSec(): number {
    return Math.floor(Date.now() / 1000);
}

function filterWindow(posts: RawPost[], windowDays: number): RawPost[] {
    const cutoffNow = nowSec();
    return posts.filter((p) => withinWindow(p.createdUtc, windowDays, cutoffNow));
}

// Fetch + cache + window filter for the query tools. Carries any droppedSubreddits
// from the client's spec §6 bad-subreddit retry through to the tool response.
async function fetchSearch(cl: RedditClient, query: string, subreddits: string[], windowDays: number, limit: number): Promise<QueryResult> {
    const key = `s:${query}|${[...subreddits].sort().join('+')}|${windowDays}`;
    const cached = cache.get(key);
    const res = cached ?? await cl.search(query, subreddits, windowToBucket(windowDays), limit);
    if (!cached) {
        cache.set(key, res);
        logDroppedSubreddits(res.droppedSubreddits, { query, requested: subreddits });
    }
    return { posts: filterWindow(res.posts, windowDays), droppedSubreddits: res.droppedSubreddits };
}

// Surface the §6 bad-subreddit salvage to the run log (observability — the drop is also
// returned to the caller). Logged once at the live fetch, not on cache hits.
function logDroppedSubreddits(dropped: string[], context: Record<string, unknown>): void {
    if (dropped.length) {
        log.warning(`Dropped inaccessible subreddit(s) and retried with the remainder: ${dropped.join(', ')}`, context);
    }
}

// Narrow the reported "queried" set to the subs actually searched, and surface any
// drops from the client's §6 retry so the agent knows a bad subreddit was skipped.
function queriedSubs(subreddits: string[], dropped: string[]): string[] {
    return subreddits.filter((s) => !dropped.includes(s));
}

function toToolError(e: unknown): Record<string, unknown> {
    if (e instanceof RedditRateLimitError) return { error: 'Reddit rate limit reached. Retry shortly.', resetAt: e.resetAt };
    if (e instanceof RedditAuthError) return { error: e.message };
    if (e instanceof ArgError) return { error: e.message };
    if (e instanceof ConfigError) return { error: e.message };
    return { error: e instanceof Error ? e.message : 'Unknown error' };
}

function asJson(value: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

const queryShape = {
    query: z.string().describe('Brand, tool, library, or topic to analyze (e.g. "prisma", "tailwind").'),
    subreddits: z.array(z.string()).optional().describe('Developer subreddits to search; defaults to the configured set.'),
    windowDays: z.number().int().optional().describe('Look-back window in days (1–90).'),
};
const queryShapeWithLimit = {
    ...queryShape,
    limit: z.number().int().optional().describe('Maximum number of items to return.'),
};
const trendingShape = {
    subreddits: z.array(z.string()).optional().describe('Developer subreddits to scan; defaults to the configured set.'),
    windowDays: z.number().int().optional().describe('Look-back window in days (1–90).'),
    limit: z.number().int().optional().describe('Maximum number of items to return.'),
};

// A fresh server per request keeps the stateless transport isolated (no session bleed).
function buildMcpServer(): McpServer {
    const server = new McpServer({ name: 'reddit-developer-sentiment-mcp', version: '0.1.0' });

    server.registerTool('get_sentiment_summary', {
        title: 'Get developer sentiment summary',
        description: 'Aggregate developer-Reddit sentiment, mention volume, top themes, and representative samples for a brand/tool/topic.',
        inputSchema: queryShape,
    }, async (args) => {
        const c = cfg; const cl = client;
        if (!c || !cl) return asJson({ error: bootError ?? CREDS_MSG });
        try {
            const a = parseQueryArgs(args, c);
            const { posts, droppedSubreddits } = await fetchSearch(cl, a.query, a.subreddits, a.windowDays, a.limit);
            const out = buildSentimentSummary(a.query, queriedSubs(a.subreddits, droppedSubreddits), a.windowDays, posts, new Date().toISOString());
            return asJson(droppedSubreddits.length ? { ...out, droppedSubreddits } : out);
        } catch (e) { return asJson(toToolError(e)); }
    });

    server.registerTool('search_mentions', {
        title: 'Search developer mentions',
        description: 'Matched developer-Reddit posts mentioning the query, each with per-item sentiment, ranked by score and recency.',
        inputSchema: queryShapeWithLimit,
    }, async (args) => {
        const c = cfg; const cl = client;
        if (!c || !cl) return asJson({ error: bootError ?? CREDS_MSG });
        try {
            const a = parseQueryArgs(args, c);
            const { posts, droppedSubreddits } = await fetchSearch(cl, a.query, a.subreddits, a.windowDays, a.limit);
            const out = buildSearchMentions(a.query, queriedSubs(a.subreddits, droppedSubreddits), a.windowDays, a.limit, posts, new Date().toISOString());
            return asJson(droppedSubreddits.length ? { ...out, droppedSubreddits } : out);
        } catch (e) { return asJson(toToolError(e)); }
    });

    server.registerTool('get_feature_requests', {
        title: 'Get feature requests and pain points',
        description: 'Feature requests, wishes, and pain points about the query, grouped by cue category (request/wish/missing/plans/painpoint).',
        inputSchema: queryShapeWithLimit,
    }, async (args) => {
        const c = cfg; const cl = client;
        if (!c || !cl) return asJson({ error: bootError ?? CREDS_MSG });
        try {
            const a = parseQueryArgs(args, c);
            const { posts, droppedSubreddits } = await fetchSearch(cl, a.query, a.subreddits, a.windowDays, a.limit);
            const out = buildFeatureRequests(a.query, queriedSubs(a.subreddits, droppedSubreddits), a.windowDays, a.limit, posts, new Date().toISOString());
            return asJson(droppedSubreddits.length ? { ...out, droppedSubreddits } : out);
        } catch (e) { return asJson(toToolError(e)); }
    });

    server.registerTool('get_trending_discussions', {
        title: 'Get trending developer discussions',
        description: 'Highest-engagement recent threads across the target developer subreddits (no query required).',
        inputSchema: trendingShape,
    }, async (args) => {
        const c = cfg; const cl = client;
        if (!c || !cl) return asJson({ error: bootError ?? CREDS_MSG });
        try {
            const a = parseTrendingArgs(args, c);
            const key = `t:${[...a.subreddits].sort().join('+')}|${a.windowDays}`;
            let res = cache.get(key);
            if (!res) {
                res = await cl.top(a.subreddits, windowToBucket(a.windowDays), a.limit);
                cache.set(key, res);
                logDroppedSubreddits(res.droppedSubreddits, { requested: a.subreddits });
            }
            const dropped = res.droppedSubreddits;
            const out = buildTrending(queriedSubs(a.subreddits, dropped), a.windowDays, a.limit, filterWindow(res.posts, a.windowDays), new Date().toISOString());
            return asJson(dropped.length ? { ...out, droppedSubreddits: dropped } : out);
        } catch (e) { return asJson(toToolError(e)); }
    });

    return server;
}

function readBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
            if (!raw) return resolve(undefined);
            try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
        });
        req.on('error', reject);
    });
}

const PORT = process.env.APIFY_CONTAINER_PORT ? parseInt(process.env.APIFY_CONTAINER_PORT, 10) : 3000;

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = (req.url ?? '').split('?')[0];

    // Apify Standby readiness probe at GET /.
    if (req.method === 'GET' && (url === '/' || url === '')) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(req.headers['x-apify-container-server-readiness-probe'] ? 'Readiness probe OK\n' : 'Actor is ready\n');
        return;
    }

    // MCP transport (stateless: one server + transport per request).
    if (url === '/mcp') {
        try {
            const body = req.method === 'POST' ? await readBody(req) : undefined;
            const mcp = buildMcpServer();
            const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
            res.on('close', () => { transport.close(); mcp.close(); });
            await mcp.connect(transport);
            await transport.handleRequest(req, res, body);
        } catch (err) {
            log.exception(err as Error, 'MCP request handling failed');
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null }));
            }
        }
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

httpServer.listen(PORT, () => log.info(`Standby MCP server listening on port ${PORT}`, {
    mcpPath: '/mcp', cacheTtlMinutes: ttlMs / 60_000, configured: !!cfg,
}));

Actor.on('aborting', async () => {
    httpServer.close();
    await Actor.exit();
});
