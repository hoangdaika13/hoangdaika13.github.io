'use strict';
const crypto = require('node:crypto'), P = require('./platform'), M = require('../hh-multiverse-model'), E = require('../hh-multiverse-engine'), AI = require('./multiverse-ai'), { parseGeminiKeys } = require('./gemini-key-pool');
const error = (status, message, code = 'MULTIVERSE_REQUEST_FAILED') => { throw Object.assign(Error(message), { status, code }); };
const validate = fn => { try {
    return fn();
}
catch (e) {
    error(400, e.message, 'MULTIVERSE_INVALID');
} };
const canModerate = u => Boolean(u && (P.isOwnerUser(u) || [...(Array.isArray(u.systemRoles) ? u.systemRoles : []), ...(Array.isArray(u.roles) ? u.roles : []), u.role].some(role => ['super_admin', 'admin', 'moderator'].includes(String(role || '').toLowerCase()))));
const digest = w => crypto.createHash('sha256').update(JSON.stringify(w)).digest('hex');
const indexed = new WeakMap();
function ensureIndexes(db) {
    if (!indexed.has(db)) {
        const task = Promise.all([
            db.collection('multiverse_worlds').createIndex({ ownerId: 1, deleted: 1, updatedAt: -1 }),
            db.collection('multiverse_shares').createIndex({ token: 1 }, { unique: true, sparse: true }),
            db.collection('multiverse_shares').createIndex({ visibility: 1, status: 1, updatedAt: -1 }),
            db.collection('multiverse_reports').createIndex({ createdAt: -1 })
        ]).catch(e => { indexed.delete(db); throw e; });
        indexed.set(db, task);
    }
    return indexed.get(db);
}
function contentCheck(world) { const publicWorld = M.publicView(world), text = JSON.stringify(publicWorld); if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text) || /\b(?:AIza[\w-]{30,}|sk-(?:proj-)?[\w-]{30,})\b/.test(text))
    error(422, 'Bản chia sẻ có email hoặc chuỗi giống khóa bí mật. Hãy loại thông tin riêng trước khi chia sẻ.', 'MULTIVERSE_PUBLIC_CONTENT'); return publicWorld; }
function createHandler(deps = {}) {
    const getUser = deps.getUser || P.currentUser, baseDb = deps.getDb || P.database, getDb = async () => { const db = await baseDb(); await ensureIndexes(db); return db; }, rate = deps.rateLimit || P.enforceRateLimit, keys = deps.keys || parseGeminiKeys, generate = deps.generate || AI.generate, chat = deps.chat || AI.chat;
    return async (req, res) => {
        P.setCors(req, res);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        if (req.method === 'OPTIONS')
            return res.status(204).end();
        try {
            P.assertTrustedMutation(req);
            const action = String(req.query?.multiverseAction || 'status');
            if (action === 'status' && req.method === 'GET')
                return res.status(200).json({ ok: true, configured: keys().length > 0, cloudConfigured: deps.cloudConfigured ?? Boolean(process.env.MONGODB_URI), provider: 'gemini', requiresLogin: true, offline: true, schemaVersion: 1, limits: { bytes: M.MAX_BYTES, snapshots: M.MAX_SNAPSHOTS, branches: M.MAX_BRANCHES }, publicReviewRequired: true });
            if (action === 'explore' && req.method === 'GET') {
                const db = await getDb();
                await rate(db, 'multiverse-explore:' + String(req.headers?.['x-forwarded-for'] || 'guest').slice(0, 120), 100, 600000);
                const rows = await db.collection('multiverse_shares').find({ visibility: 'public', status: 'approved' }).sort({ updatedAt: -1 }).limit(24).toArray();
                const results = [];
                for (const r of rows) {
                    const owner = await db.collection('multiverse_worlds').findOne({ _id: r.worldKey, deleted: { $ne: true } });
                    if (owner)
                        results.push({ token: r.token, name: r.world.name, premise: r.world.premise.slice(0, 300), mode: r.world.settings.mode, branchCount: r.world.branches.length, eventCount: r.world.events.length, allowClone: r.allowClone, updatedAt: r.updatedAt });
                }
                return res.status(200).json({ ok: true, universes: results });
            }
            if (action === 'shared' && req.method === 'GET') {
                const token = validate(() => M.id(req.query.token)), db = await getDb();
                await rate(db, 'multiverse-shared:' + String(req.headers?.['x-forwarded-for'] || 'guest').slice(0, 120), 120, 600000);
                const row = await db.collection('multiverse_shares').findOne({ token });
                if (!row || !['unlisted', 'approved'].includes(row.status) || row.visibility === 'private' || !await db.collection('multiverse_worlds').findOne({ _id: row.worldKey, deleted: { $ne: true } }))
                    error(404, 'Liên kết không tồn tại, đã thu hồi hoặc chưa được duyệt.');
                return res.status(200).json({ ok: true, world: M.publicView(row.world), allowClone: row.allowClone === true, revision: row.revision, fictional: true });
            }
            const user = await getUser(req);
            if (!user?._id)
                error(401, 'Đăng nhập để dùng Gemini, đồng bộ hoặc chia sẻ. Mô phỏng offline vẫn dùng được.', 'AUTH_REQUIRED');
            const ownerId = String(user._id), body = req.method === 'GET' ? {} : P.bodyOf(req, { maxBodyBytes: 900000, maxNodes: 50000 }), db = await getDb(), worlds = db.collection('multiverse_worlds'), shares = db.collection('multiverse_shares');
            if (['generate', 'character'].includes(action) && req.method === 'POST') {
                const keyList = keys();
                if (!keyList.length)
                    error(503, 'Gemini chưa được cấu hình. Chọn mô phỏng offline để tiếp tục.', 'MULTIVERSE_AI_NOT_CONFIGURED');
                await rate(db, 'multiverse-ai:' + ownerId, 8, 600000);
                await rate(db, 'multiverse-ai-ip:' + String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').slice(0, 120), 20, 600000);
                const cancel = new AbortController(), abort = () => { if (!res.writableEnded)
                    cancel.abort(); };
                req.once?.('aborted', abort);
                res.once?.('close', abort);
                try {
                    if (action === 'generate') {
                        const premise = validate(() => M.text(body.premise, 2000)), settings = validate(() => M.settings(body.settings || {}));
                        if (settings.mode === 'custom' && !settings.customRules)
                            error(400, 'Custom cần ít nhất một quy tắc.');
                        const out = await generate({ premise, settings, keys: keyList, signal: cancel.signal });
                        const world = E.create(premise, settings, { id: crypto.randomUUID(), provider: 'gemini', blueprint: out.blueprint, model: out.model });
                        return res.status(200).json({ ok: true, world, provider: 'gemini' });
                    }
                    const world = validate(() => M.universe(body.world)), characterId = validate(() => M.id(body.characterId)), question = validate(() => M.text(body.question, 2000)), result = await chat({ world, characterId, question, keys: keyList, signal: cancel.signal });
                    const check = require('../hh-multiverse-internet').saveChat(world, characterId, question, result);
                    return res.status(200).json({ ok: true, result: check.conversations.at(-1), provider: 'gemini' });
                }
                finally {
                    req.removeListener?.('aborted', abort);
                    res.removeListener?.('close', abort);
                }
            }
            if (action === 'worlds') {
                if (req.method === 'GET') {
                    await rate(db, 'multiverse-read:' + ownerId, 150, 3600000);
                    if (req.query.id) {
                        const id = validate(() => M.id(req.query.id)), row = await worlds.findOne({ _id: ownerId + ':' + id, ownerId });
                        if (!row || row.deleted)
                            error(404, 'Chưa có bản máy chủ của vũ trụ này.');
                        return res.status(200).json({ ok: true, world: M.universe(row.world), revision: row.revision, updatedAt: row.updatedAt });
                    }
                    const rows = await worlds.find({ ownerId, deleted: { $ne: true } }).sort({ updatedAt: -1 }).limit(30).toArray();
                    return res.status(200).json({ ok: true, worlds: rows.map(r => ({ id: r.id, name: r.world.name, premise: r.world.premise.slice(0, 250), revision: r.revision, updatedAt: r.updatedAt, branches: r.world.branches.length, events: r.world.events.length })) });
                }
                if (!['PUT', 'DELETE'].includes(req.method))
                    error(405, 'Phương thức chưa hỗ trợ.');
                await rate(db, 'multiverse-write:' + ownerId, 50, 3600000);
                const id = validate(() => M.id(body.id)), revision = validate(() => M.integer(body.revision, 0, 10000000)), _id = ownerId + ':' + id, at = new Date().toISOString();
                if (req.method === 'DELETE') {
                    const result = await worlds.updateOne({ _id, ownerId, revision, deleted: { $ne: true } }, { $set: { world: null, deleted: true, updatedAt: at }, $inc: { revision: 1 } });
                    if (!result.matchedCount)
                        error(409, 'Bản máy chủ đã thay đổi hoặc đã xóa. Bản trên thiết bị được giữ.', 'MULTIVERSE_CONFLICT');
                    await shares.updateMany({ worldKey: _id, ownerId }, { $set: { visibility: 'private', status: 'private', updatedAt: at } });
                    return res.status(200).json({ ok: true, deleted: true, revision: revision + 1 });
                }
                const world = validate(() => M.universe(body.world));
                if (world.id !== id)
                    error(400, 'ID vũ trụ chưa khớp.');
                if (revision === 0) {
                    if (await worlds.countDocuments({ ownerId, deleted: { $ne: true } }) >= 20)
                        error(409, 'Tối đa20 bản máy chủ; xuất và xóa bớt trước.');
                    try {
                        await worlds.insertOne({ _id, id, ownerId, world, revision: 1, deleted: false, createdAt: at, updatedAt: at });
                    }
                    catch (e) {
                        if (e.code === 11000)
                            error(409, 'ID đã có bản máy chủ hoặc đã xóa; tải về để đối chiếu hoặc sao chép thành ID mới.', 'MULTIVERSE_CONFLICT');
                        throw e;
                    }
                }
                else {
                    const result = await worlds.updateOne({ _id, ownerId, revision, deleted: { $ne: true } }, { $set: { world, updatedAt: at }, $inc: { revision: 1 } });
                    if (!result.matchedCount)
                        error(409, 'Thiết bị khác đã cập nhật. Hãy xem bản máy chủ; dữ liệu đang làm được giữ.', 'MULTIVERSE_CONFLICT');
                }
                return res.status(200).json({ ok: true, id, revision: revision + 1, updatedAt: at, digest: digest(world) });
            }
            if (action === 'publish' && req.method === 'POST') {
                await rate(db, 'multiverse-publish:' + ownerId, 12, 3600000);
                const id = validate(() => M.id(body.id)), worldKey = ownerId + ':' + id, source = await worlds.findOne({ _id: worldKey, ownerId, deleted: { $ne: true } });
                if (!source)
                    error(404, 'Đồng bộ vũ trụ trước khi chia sẻ.');
                if (source.revision !== body.revision)
                    error(409, 'Bản máy chủ đã đổi; đồng bộ lại trước khi chia sẻ.');
                if (!['private', 'unlisted', 'public'].includes(body.visibility))
                    error(400, 'Chọn chế độ chia sẻ hợp lệ.');
                const _id = worldKey, old = await shares.findOne({ _id, ownerId }), at = new Date().toISOString(), world = body.visibility === 'private' ? M.publicView(source.world) : contentCheck(source.world), revision = (old?.revision || 0) + 1, token = old && old.visibility !== 'private' ? old.token : 'share-' + crypto.randomBytes(24).toString('base64url'), status = body.visibility === 'public' ? 'pending' : body.visibility === 'unlisted' ? 'unlisted' : 'private';
                const row = { ownerId, worldKey, token, world, sourceRevision: source.revision, revision, visibility: body.visibility, status, allowClone: body.allowClone === true, updatedAt: at, createdAt: old?.createdAt || at, contentHash: digest(world) };
                if (old) {
                    const result = await shares.updateOne({ _id, ownerId, revision: old.revision }, { $set: row });
                    if (!result.matchedCount)
                        error(409, 'Bản chia sẻ vừa thay đổi. Hãy tải lại.');
                }
                else {
                    try {
                        await shares.insertOne({ _id, ...row });
                    }
                    catch (e) {
                        if (e.code === 11000)
                            error(409, 'Thiết bị khác vừa tạo bản chia sẻ.');
                        throw e;
                    }
                }
                return res.status(200).json({ ok: true, visibility: row.visibility, status, revision, token: status === 'unlisted' || status === 'approved' ? token : null, reviewRequired: status === 'pending' });
            }
            if (action === 'moderation') {
                if (!canModerate(user))
                    error(403, 'Chỉ quản trị viên hoặc moderator được duyệt xuất bản.', 'ADMIN_REQUIRED');
                if (req.method === 'GET') {
                    const pending = await shares.find({ status: 'pending' }).sort({ updatedAt: -1 }).limit(40).toArray();
                    const reports = await db.collection('multiverse_reports').find({}).sort({ createdAt: -1 }).limit(40).toArray();
                    return res.status(200).json({ ok: true, pending: pending.map(r => ({ id: r._id, revision: r.revision, name: r.world.name, premise: r.world.premise, contentHash: r.contentHash, updatedAt: r.updatedAt, world: M.publicView(r.world) })), reports: reports.map(r => ({ id: r._id, token: r.token, reason: r.reason, createdAt: r.createdAt })) });
                }
                if (req.method === 'PATCH') {
                    await rate(db, 'multiverse-review:' + ownerId, 40, 3600000);
                    if (!['approved', 'rejected'].includes(body.status) || typeof body.id !== 'string' || body.id.length > 250 || typeof body.note !== 'string' || body.note.length > 1000 || !Number.isInteger(body.revision))
                        error(400, 'Nội dung duyệt chưa hợp lệ.');
                    const result = await shares.updateOne({ _id: body.id, revision: body.revision, status: 'pending', visibility: 'public' }, { $set: { status: body.status, reviewedBy: ownerId, reviewNote: body.note, updatedAt: new Date().toISOString() }, $inc: { revision: 1 } });
                    if (!result.matchedCount)
                        error(409, 'Bản chờ duyệt đã thay đổi. Hãy tải lại.');
                    return res.status(200).json({ ok: true, status: body.status });
                }
            }
            if (action === 'report' && req.method === 'POST') {
                const token = validate(() => M.id(body.token)), reason = validate(() => M.text(body.reason, 1200));
                if (!await shares.findOne({ token }))
                    error(404, 'Liên kết không tồn tại.');
                await rate(db, 'multiverse-report:' + ownerId, 6, 3600000);
                await db.collection('multiverse_reports').insertOne({ _id: crypto.randomUUID(), ownerId, token, reason, createdAt: new Date().toISOString() });
                return res.status(201).json({ ok: true, submitted: true });
            }
            error(405, 'Chức năng hoặc phương thức chưa hỗ trợ.');
        }
        catch (e) {
            const status = Number(e.status || e.statusCode) || 500;
            if (status === 429)
                res.setHeader('Retry-After', String(e.retryAfter || 60));
            return res.status(status >= 400 && status < 600 ? status : 500).json({ error: status === 500 ? 'Dịch vụ chưa xử lý được yêu cầu; dữ liệu trên thiết bị được giữ.' : String(e.message || 'Yêu cầu thất bại.').slice(0, 500), code: e.code || 'MULTIVERSE_REQUEST_FAILED' });
        }
    };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.__test = { contentCheck, canModerate };
