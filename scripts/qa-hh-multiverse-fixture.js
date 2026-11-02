'use strict';
// Explicit QA identities and model responses around the actual production handler.
const H = require('../utils/multiverse-handler'), E = require('../hh-multiverse-engine'), I = require('../hh-multiverse-internet'), { createEducationMemoryDB } = require('../tests/helpers/hh-school-memory-db');
module.exports = function () {
    const state = { user: null, configured: true, quota: false, delay: 0 }, calls = [], db = createEducationMemoryDB();
    const handler = H.createHandler({ getUser: async () => state.user, getDb: async () => db, cloudConfigured: true, keys: () => state.configured ? ['explicit-multiverse-QA-key'] : [], rateLimit: async () => { }, generate: async (input) => { calls.push({ action: 'generate', premise: input.premise }); if (state.quota)
            throw Object.assign(Error('QA Gemini quota fixture'), { status: 429 }); if (state.delay)
            await new Promise(r => setTimeout(r, state.delay)); return { blueprint: E.offlineBlueprint(input.premise, input.settings), model: 'explicit-Gemini-QA-fixture' }; }, chat: async (input) => { calls.push({ action: 'character', context: I.chatContext(input.world, input.characterId) }); return { ...I.offlineChat(input.world, input.characterId, input.question), provider: 'gemini', model: 'explicit-Gemini-QA-fixture' }; } });
    return { state, calls, db, async handle(req, res) { const chunks = []; let size = 0; for await (const chunk of req) {
            size += chunk.length;
            if (size > 900000) {
                res.writeHead(413).end();
                return;
            }
            chunks.push(chunk);
        } const url = new URL(req.url, 'http://localhost'); req.body = Buffer.concat(chunks).toString('utf8') || undefined; req.query = { multiverseAction: url.pathname.split('/').at(-1), ...Object.fromEntries(url.searchParams) }; res.status = n => { res.statusCode = n; return res; }; res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return res; }; await handler(req, res); } };
};
