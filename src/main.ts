import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Actor, log } from 'apify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { parseConfig, ConfigError } from './config.js';
import { parseQueryArgs, parseTrendingArgs, ArgError } from './argParser.js';
import { HnClient, HnRateLimitError, HnHttpError } from './hnClient.js';
import { TtlLruCache } from './cache.js';
import { withinWindow } from './timeWindow.js';
import { buildSentimentSummary } from './tools/getSentimentSummary.js';
import { buildSearchMentions } from './tools/searchMentions.js';
import { buildTrending } from './tools/getTrendingDiscussions.js';
import { buildFeatureRequests } from './tools/getFeatureRequests.js';
import type { Config, HnChannel, RawPost } from './types.js';

await Actor.init();

// The Algolia HN API needs no credentials, so the actor is useful on first boot.
// parseConfig only throws on malformed optional inputs; on that we degrade so the
// readiness probe stays green and tools return a clear error until input is fixed.
const input = (await Actor.getInput<Record<string, unknown>>()) ?? {};
let cfg: Config | null = null;
let bootError: string | null = null;
try {
    cfg = parseConfig(input);
} catch (e) {
    bootError = e instanceof Error ? e.message : 'Invalid actor input';
    log.warning(`Booting with invalid config: ${bootError} — tools will return an error until input is fixed.`);
}

const client = new HnClient();

// One raw payload per query, shared across the query tools (LRU + TTL).
const ttlMs = (cfg?.cacheTtlMinutes ?? 20) * 60_000;
const cache = new TtlLruCache<RawPost[]>({ capacity: 200, ttlMs, clock: () => Date.now() });

function nowSec(): number {
    return Math.floor(Date.now() / 1000);
}

function filterWindow(posts: RawPost[], windowDays: number): RawPost[] {
    const cutoffNow = nowSec();
    return posts.filter((p) => withinWindow(p.createdUtc, windowDays, cutoffNow));
}

// Fetch + cache + window filter for the query tools. One Algolia call per
// (query, channels, window), reused across the query tools within the TTL.
async function fetchSearch(query: string, channels: HnChannel[], windowDays: number, limit: number): Promise<RawPost[]> {
    const key = `s:${query}|${[...channels].sort().join('+')}|${windowDays}`;
    const cached = cache.get(key);
    const posts = cached ?? await client.search(query, channels, windowDays, limit);
    if (!cached) cache.set(key, posts);
    return filterWindow(posts, windowDays);
}

function toToolError(e: unknown): Record<string, unknown> {
    if (e instanceof HnRateLimitError) return { error: 'Hacker News rate limit reached. Retry shortly.', resetAt: e.resetAt };
    if (e instanceof HnHttpError) return { error: `Hacker News request failed (${e.status}). Retry shortly.` };
    if (e instanceof ArgError) return { error: e.message };
    if (e instanceof ConfigError) return { error: e.message };
    return { error: e instanceof Error ? e.message : 'Unknown error' };
}

function asJson(value: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

const CHANNEL_ENUM = z.enum(['story', 'ask_hn', 'show_hn', 'comment']);
const queryShape = {
    query: z.string().describe('Brand, tool, library, or topic to analyze (e.g. "prisma", "tailwind").'),
    channels: z.array(CHANNEL_ENUM).optional().describe('HN post types to search (story, ask_hn, show_hn, comment); defaults to all.'),
    windowDays: z.number().int().optional().describe('Look-back window in days (1–90).'),
};
const queryShapeWithLimit = {
    ...queryShape,
    limit: z.number().int().optional().describe('Maximum number of items to return.'),
};
const trendingShape = {
    windowDays: z.number().int().optional().describe('Look-back window in days (1–90).'),
    limit: z.number().int().optional().describe('Maximum number of items to return.'),
};

// A fresh server per request keeps the stateless transport isolated (no session bleed).
function buildMcpServer(): McpServer {
    const server = new McpServer({ name: 'hn-developer-sentiment-mcp', version: '0.1.0' });

    server.registerTool('get_sentiment_summary', {
        title: 'Get developer sentiment summary',
        description: 'Aggregate Hacker News developer sentiment, mention volume, top themes, and representative samples for a brand/tool/topic.',
        inputSchema: queryShape,
    }, async (args) => {
        const c = cfg;
        if (!c) return asJson({ error: bootError ?? 'Invalid actor input' });
        try {
            const a = parseQueryArgs(args, c);
            const posts = await fetchSearch(a.query, a.channels, a.windowDays, a.limit);
            return asJson(buildSentimentSummary(a.query, a.channels, a.windowDays, posts, new Date().toISOString()));
        } catch (e) { return asJson(toToolError(e)); }
    });

    server.registerTool('search_mentions', {
        title: 'Search developer mentions',
        description: 'Matched Hacker News posts and comments mentioning the query, each with per-item sentiment, ranked by score and recency.',
        inputSchema: queryShapeWithLimit,
    }, async (args) => {
        const c = cfg;
        if (!c) return asJson({ error: bootError ?? 'Invalid actor input' });
        try {
            const a = parseQueryArgs(args, c);
            const posts = await fetchSearch(a.query, a.channels, a.windowDays, a.limit);
            return asJson(buildSearchMentions(a.query, a.channels, a.windowDays, a.limit, posts, new Date().toISOString()));
        } catch (e) { return asJson(toToolError(e)); }
    });

    server.registerTool('get_feature_requests', {
        title: 'Get feature requests and pain points',
        description: 'Feature requests, wishes, and pain points about the query from Hacker News, grouped by cue category (request/wish/missing/plans/painpoint).',
        inputSchema: queryShapeWithLimit,
    }, async (args) => {
        const c = cfg;
        if (!c) return asJson({ error: bootError ?? 'Invalid actor input' });
        try {
            const a = parseQueryArgs(args, c);
            const posts = await fetchSearch(a.query, a.channels, a.windowDays, a.limit);
            return asJson(buildFeatureRequests(a.query, a.channels, a.windowDays, a.limit, posts, new Date().toISOString()));
        } catch (e) { return asJson(toToolError(e)); }
    });

    server.registerTool('get_trending_discussions', {
        title: 'Get trending developer discussions',
        description: 'Highest-engagement recent Hacker News stories (no query required).',
        inputSchema: trendingShape,
    }, async (args) => {
        const c = cfg;
        if (!c) return asJson({ error: bootError ?? 'Invalid actor input' });
        try {
            const a = parseTrendingArgs(args, c);
            const key = `t:story|${a.windowDays}`;
            let posts = cache.get(key);
            if (!posts) {
                posts = await client.top(a.windowDays, a.limit);
                cache.set(key, posts);
            }
            // Trending is story-level regardless of channel selection.
            return asJson(buildTrending(['story'], a.windowDays, a.limit, filterWindow(posts, a.windowDays), new Date().toISOString()));
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
