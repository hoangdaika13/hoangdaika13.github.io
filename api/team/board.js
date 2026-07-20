const { ObjectId } = require("mongodb");
const { clean, currentUser, publicUser, withApi } = require("../../utils/platform");

const ROLES = ["viewer", "commenter", "editor", "owner"];
const ROLE_RANK = Object.freeze({ viewer: 0, commenter: 1, editor: 2, owner: 3 });
const STATUSES = ["backlog", "todo", "doing", "review", "done"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const VERSION_LIMIT = 50;

const token = () => crypto.randomUUID().replaceAll("-", "").slice(0, 20);
const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const text = (value, max = 160) => clean(value, max);
const objectId = (value, label = "Dữ liệu") => {
  const id = text(value, 64);
  if (!ObjectId.isValid(id)) throw error(`${label} không hợp lệ.`);
  return new ObjectId(id);
};
const role = (value, fallback = "viewer") => ROLES.includes(value) ? value : fallback;
const hasRole = (access, required) => ROLE_RANK[role(access?.role)] >= ROLE_RANK[required];
const requireRole = (access, required, message) => {
  if (!hasRole(access, required)) throw error(message || "Bạn không có quyền thực hiện thao tác này.", 403);
};

function safePerson(person = {}) {
  return {
    userId: String(person.userId || person._id || ""),
    name: text(person.name || person.displayName || person.username || "Thành viên", 100),
    username: text(person.username || "", 60),
    avatar: text(person.avatar || person.picture || "", 500)
  };
}

function member(board, user) {
  if (!board || !user) return undefined;
  return (board.members || []).find((item) => String(item.userId) === String(user._id));
}

function resolveAssignee(board, assigneeId, fallbackName = "") {
  const id = text(assigneeId, 64);
  if (!id) return { assigneeId: null, assignee: text(fallbackName, 160) };
  if (!ObjectId.isValid(id)) throw error("Người phụ trách không hợp lệ.");
  const selected = (board.members || []).find((item) => String(item.userId) === id);
  if (!selected) throw error("Người phụ trách không thuộc board này.", 403);
  return { assigneeId: new ObjectId(id), assignee: text(selected.name || fallbackName, 160) };
}

function automations(board) {
  return {
    completeOnSubtasks: board?.automations?.completeOnSubtasks !== false,
    reopenOnSubtask: board?.automations?.reopenOnSubtask !== false,
    startOnAssignee: board?.automations?.startOnAssignee === true
  };
}

function boardView(board, user) {
  const access = member(board, user);
  const owner = access?.role === "owner";
  return {
    id: String(board._id),
    name: board.name,
    description: board.description || "",
    shareToken: owner ? board.shareToken : undefined,
    role: role(access?.role),
    permissions: {
      view: Boolean(access),
      comment: hasRole(access, "commenter"),
      edit: hasRole(access, "editor"),
      manage: owner
    },
    members: (board.members || []).map((item) => ({ ...safePerson(item), role: role(item.role), joinedAt: item.joinedAt })),
    automations: automations(board),
    createdAt: board.createdAt,
    updatedAt: board.updatedAt
  };
}

function subtaskView(item = {}) {
  return {
    id: text(item.id, 40),
    title: text(item.title, 180),
    done: Boolean(item.done),
    assignee: text(item.assignee, 100),
    dueDate: text(item.dueDate, 32),
    estimateMinutes: Math.max(0, Math.min(100000, Number(item.estimateMinutes) || 0)),
    createdBy: safePerson(item.createdBy),
    createdAt: item.createdAt,
    completedAt: item.completedAt || null
  };
}

function commentView(item = {}) {
  return {
    id: text(item.id, 40),
    text: text(item.text, 1200),
    author: safePerson(item.author),
    mentions: Array.isArray(item.mentions) ? item.mentions.slice(0, 20).map((value) => text(value, 60)) : [],
    createdAt: item.createdAt,
    editedAt: item.editedAt || null
  };
}

function versionView(item = {}) {
  return {
    id: text(item.id, 40),
    version: Number(item.version) || 1,
    reason: text(item.reason, 240),
    author: safePerson(item.author),
    createdAt: item.createdAt,
    snapshot: item.snapshot ? snapshot(item.snapshot) : undefined
  };
}

function taskView(task = {}, options = {}) {
  return {
    _id: String(task._id),
    boardId: String(task.boardId),
    title: text(task.title, 180),
    description: text(task.description, 3000),
    status: STATUSES.includes(task.status) ? task.status : "todo",
    priority: PRIORITIES.includes(task.priority) ? task.priority : "normal",
    assignee: text(task.assignee, 160),
    assigneeId: task.assigneeId ? String(task.assigneeId) : "",
    dueDate: text(task.dueDate, 32),
    estimateMinutes: Math.max(0, Math.min(100000, Number(task.estimateMinutes) || 0)),
    labels: Array.isArray(task.labels) ? task.labels.slice(0, 12).map((item) => text(item, 32)) : [],
    dependencies: Array.isArray(task.dependencies) ? task.dependencies.map(String) : [],
    subtasks: Array.isArray(task.subtasks) ? task.subtasks.map(subtaskView) : [],
    comments: Array.isArray(task.comments) ? task.comments.map(commentView) : [],
    version: Number(task.version) || 1,
    versions: options.withVersions && Array.isArray(task.versions) ? task.versions.slice(-VERSION_LIMIT).reverse().map(versionView) : undefined,
    createdBy: safePerson(task.createdBy),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function snapshot(task = {}) {
  return {
    title: text(task.title, 180),
    description: text(task.description, 3000),
    status: STATUSES.includes(task.status) ? task.status : "todo",
    priority: PRIORITIES.includes(task.priority) ? task.priority : "normal",
    assignee: text(task.assignee, 160),
    assigneeId: task.assigneeId ? String(task.assigneeId) : "",
    dueDate: text(task.dueDate, 32),
    estimateMinutes: Math.max(0, Math.min(100000, Number(task.estimateMinutes) || 0)),
    labels: Array.isArray(task.labels) ? task.labels.slice(0, 12).map((item) => text(item, 32)) : [],
    dependencies: Array.isArray(task.dependencies) ? task.dependencies.map(String) : [],
    subtasks: Array.isArray(task.subtasks) ? task.subtasks.map(subtaskView) : []
  };
}

function requestMetadata(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return {
    requestId: text(req.headers?.["x-vercel-id"] || req.headers?.["x-request-id"] || token(), 120),
    ip: text(forwarded || req.socket?.remoteAddress || "unknown", 80),
    userAgent: text(req.headers?.["user-agent"] || "unknown", 260)
  };
}

function activityView(item = {}, includeAudit = false) {
  const value = {
    id: String(item._id || item.id || ""),
    action: text(item.action, 80),
    entityType: text(item.entityType, 40),
    entityId: String(item.entityId || ""),
    summary: text(item.summary, 300),
    actor: safePerson(item.actor),
    createdAt: item.createdAt
  };
  if (includeAudit) value.audit = { before: item.before || null, after: item.after || null, reason: item.reason || "", metadata: item.metadata || {} };
  return value;
}

async function logActivity(collection, req, data) {
  await collection.insertOne({
    boardId: data.boardId,
    action: data.action,
    entityType: data.entityType || "task",
    entityId: data.entityId || null,
    summary: text(data.summary, 300),
    actor: safePerson(data.user),
    before: data.before || null,
    after: data.after || null,
    reason: text(data.reason, 300),
    metadata: requestMetadata(req),
    createdAt: data.now || new Date()
  });
}

function versionEntry(task, user, reason, now) {
  return { id: token(), version: Number(task.version) || 1, reason: text(reason || "Cập nhật công việc", 240), author: safePerson(publicUser(user)), createdAt: now, snapshot: snapshot(task) };
}

function applyStatusAutomation(current, update, board) {
  const rules = automations(board);
  const merged = { ...current, ...update };
  const items = Array.isArray(merged.subtasks) ? merged.subtasks : [];
  if (rules.completeOnSubtasks && items.length && items.every((item) => item.done)) update.status = "done";
  if (rules.reopenOnSubtask && merged.status === "done" && items.some((item) => !item.done)) update.status = "doing";
  if (rules.startOnAssignee && current.status === "todo" && !current.assignee && update.assignee) update.status = "doing";
  return update;
}

async function validateDependencies(tasks, boardId, taskId, values) {
  const ids = [...new Set((Array.isArray(values) ? values : []).map((item) => text(item, 64)).filter(Boolean))];
  if (ids.length > 20) throw error("Một công việc chỉ được có tối đa 20 dependency.");
  if (ids.some((id) => id === String(taskId))) throw error("Công việc không thể phụ thuộc chính nó.");
  if (ids.some((id) => !ObjectId.isValid(id))) throw error("Dependency không hợp lệ.");
  if (!ids.length) return [];
  const records = await tasks.find({ boardId, _id: { $in: ids.map((id) => new ObjectId(id)) } }).project({ _id: 1, dependencies: 1 }).toArray();
  if (records.length !== ids.length) throw error("Có dependency không thuộc board này.", 403);
  const graphRecords = await tasks.find({ boardId }).project({ _id: 1, dependencies: 1 }).limit(500).toArray();
  const graph = new Map(graphRecords.map((item) => [String(item._id), (item.dependencies || []).map(String)]));
  const reachesTask = (start) => {
    const queue = [start]; const visited = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (id === String(taskId)) return true;
      if (visited.has(id)) continue;
      visited.add(id);
      queue.push(...(graph.get(id) || []));
    }
    return false;
  };
  if (ids.some(reachesTask)) throw error("Dependency tạo thành vòng lặp.");
  return ids.map((id) => new ObjectId(id));
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const user = await currentUser(req);
    if (!user) throw error("Đăng nhập để dùng không gian nhóm.", 401);
    const boards = db.collection("teamBoards");
    const tasks = db.collection("teamBoardTasks");
    const activity = db.collection("teamBoardActivity");
    const action = text(body.action || req.query.action, 40);
    const boardId = text(body.boardId || req.query.boardId, 64);

    if (req.method === "GET") {
      const board = await boards.findOne({ _id: objectId(boardId, "Board") });
      const access = member(board, user);
      if (!board || !access) throw error("Bạn chưa có quyền truy cập board này.", 403);
      if (action === "task-history") {
        const task = await tasks.findOne({ _id: objectId(req.query.taskId, "Công việc"), boardId: board._id });
        if (!task) throw error("Không tìm thấy công việc.", 404);
        return res.status(200).json({ taskId: String(task._id), version: Number(task.version) || 1, versions: (task.versions || []).slice(-VERSION_LIMIT).reverse().map(versionView) });
      }
      if (action === "audit-log") {
        requireRole(access, "owner", "Chỉ owner được xem audit metadata.");
        const records = await activity.find({ boardId: board._id }).sort({ createdAt: -1 }).limit(200).toArray();
        return res.status(200).json({ activity: records.map((item) => activityView(item, true)) });
      }
      const [records, recent] = await Promise.all([
        tasks.find({ boardId: board._id }).sort({ updatedAt: -1 }).limit(500).toArray(),
        activity.find({ boardId: board._id }).sort({ createdAt: -1 }).limit(80).toArray()
      ]);
      return res.status(200).json({ board: boardView(board, user), tasks: records.map((item) => taskView(item)), activity: recent.map((item) => activityView(item, false)) });
    }
    if (req.method !== "POST") throw error("Method not allowed", 405);

    if (action === "create-board") {
      const now = new Date();
      const board = {
        name: text(body.name || "Nhóm HH", 100), description: text(body.description, 360), ownerId: user._id, shareToken: token(),
        defaultJoinRole: "commenter", automations: { completeOnSubtasks: true, reopenOnSubtask: true, startOnAssignee: false },
        members: [{ ...safePerson(publicUser(user)), userId: user._id, role: "owner", joinedAt: now }], createdAt: now, updatedAt: now
      };
      const result = await boards.insertOne(board); board._id = result.insertedId;
      await logActivity(activity, req, { boardId: board._id, action: "create-board", entityType: "board", entityId: board._id, summary: `Tạo board ${board.name}`, user, after: { name: board.name }, now });
      return res.status(201).json({ board: boardView(board, user) });
    }

    if (action === "join-board") {
      if (!ObjectId.isValid(boardId) || !text(body.shareToken, 80)) throw error("Thiếu mã tham gia board.");
      const board = await boards.findOne({ _id: new ObjectId(boardId), shareToken: text(body.shareToken, 80) });
      if (!board) throw error("Liên kết chia sẻ không hợp lệ hoặc đã hết hạn.", 404);
      const now = new Date();
      if (!member(board, user)) {
        const joinRole = role(board.defaultJoinRole, "commenter");
        if (joinRole === "owner") throw error("Cấu hình quyền tham gia không hợp lệ.", 500);
        await boards.updateOne({ _id: board._id }, { $push: { members: { ...safePerson(publicUser(user)), userId: user._id, role: joinRole, joinedAt: now } }, $set: { updatedAt: now } });
        await logActivity(activity, req, { boardId: board._id, action: "join-board", entityType: "member", entityId: user._id, summary: `${safePerson(user).name} tham gia board`, user, now });
      }
      const updated = await boards.findOne({ _id: board._id });
      return res.status(200).json({ board: boardView(updated, user) });
    }

    const board = await boards.findOne({ _id: objectId(boardId, "Board") });
    const access = member(board, user);
    if (!board || !access) throw error("Bạn chưa có quyền truy cập board này.", 403);
    const now = new Date();

    if (action === "update-member-role") {
      requireRole(access, "owner", "Chỉ owner được thay đổi quyền thành viên.");
      const userId = objectId(body.userId, "Thành viên");
      const nextRole = role(body.role, "viewer");
      if (nextRole === "owner") throw error("Không thể chuyển owner bằng thao tác này.");
      if (String(userId) === String(board.ownerId)) throw error("Không thể đổi quyền owner.");
      const target = (board.members || []).find((item) => String(item.userId) === String(userId));
      if (!target) throw error("Thành viên không thuộc board.", 404);
      await boards.updateOne({ _id: board._id, "members.userId": userId }, { $set: { "members.$.role": nextRole, updatedAt: now } });
      await logActivity(activity, req, { boardId: board._id, action, entityType: "member", entityId: userId, summary: `Đổi quyền ${target.name} thành ${nextRole}`, user, before: { role: target.role }, after: { role: nextRole }, reason: body.reason, now });
      const updated = await boards.findOne({ _id: board._id });
      return res.status(200).json({ board: boardView(updated, user) });
    }

    if (action === "update-automation") {
      requireRole(access, "editor");
      const next = {
        completeOnSubtasks: body.automations?.completeOnSubtasks !== false,
        reopenOnSubtask: body.automations?.reopenOnSubtask !== false,
        startOnAssignee: body.automations?.startOnAssignee === true
      };
      await boards.updateOne({ _id: board._id }, { $set: { automations: next, updatedAt: now } });
      await logActivity(activity, req, { boardId: board._id, action, entityType: "board", entityId: board._id, summary: "Cập nhật automation", user, before: automations(board), after: next, reason: body.reason, now });
      return res.status(200).json({ automations: next });
    }

    if (action === "create-task") {
      requireRole(access, "editor", "Bạn cần quyền editor để tạo công việc.");
      const assigned = resolveAssignee(board, body.assigneeId, body.assignee);
      const task = {
        boardId: board._id, title: text(body.title, 180), description: text(body.description, 3000),
        status: STATUSES.includes(body.status) ? body.status : "todo", priority: PRIORITIES.includes(body.priority) ? body.priority : "normal",
        assignee: assigned.assignee, assigneeId: assigned.assigneeId,
        dueDate: text(body.dueDate, 32), estimateMinutes: Math.max(0, Math.min(100000, Number(body.estimateMinutes) || 0)),
        labels: Array.isArray(body.labels) ? body.labels.slice(0, 12).map((item) => text(item, 32)).filter(Boolean) : [],
        dependencies: [], subtasks: [], createdBy: safePerson(publicUser(user)), comments: [], version: 1, versions: [], createdAt: now, updatedAt: now
      };
      if (!task.title) throw error("Nhập tên công việc.");
      const result = await tasks.insertOne(task); task._id = result.insertedId;
      task.dependencies = await validateDependencies(tasks, board._id, task._id, body.dependencies);
      if (task.dependencies.length) await tasks.updateOne({ _id: task._id, boardId: board._id }, { $set: { dependencies: task.dependencies } });
      await boards.updateOne({ _id: board._id }, { $set: { updatedAt: now } });
      await logActivity(activity, req, { boardId: board._id, action, entityType: "task", entityId: task._id, summary: `Tạo công việc ${task.title}`, user, after: snapshot(task), now });
      return res.status(201).json({ task: taskView(task) });
    }

    const taskId = objectId(body.taskId, "Công việc");
    const taskQuery = { _id: taskId, boardId: board._id };
    const current = await tasks.findOne(taskQuery);
    if (!current) throw error("Không tìm thấy công việc hoặc công việc không thuộc board này.", 404);

    if (action === "comment") {
      requireRole(access, "commenter", "Bạn cần quyền commenter để bình luận.");
      const value = text(body.comment, 1200);
      if (!value) throw error("Bình luận đang trống.");
      const mentions = [...new Set([...value.matchAll(/@([\p{L}\p{N}._-]{2,40})/gu)].map((match) => match[1]))].slice(0, 20);
      const comment = { id: token(), text: value, author: safePerson(publicUser(user)), mentions, createdAt: now };
      await tasks.updateOne(taskQuery, { $push: { comments: comment }, $set: { updatedAt: now } });
      await logActivity(activity, req, { boardId: board._id, action, entityType: "comment", entityId: taskId, summary: `Bình luận trong ${current.title}`, user, after: { commentId: comment.id, mentions }, now });
      const updated = await tasks.findOne(taskQuery);
      return res.status(200).json({ task: taskView(updated) });
    }

    requireRole(access, "editor", "Bạn cần quyền editor để chỉnh sửa công việc.");
    const before = snapshot(current);
    const history = versionEntry(current, user, body.reason, now);
    let update = { updatedAt: now };
    let actionSummary = `Cập nhật ${current.title}`;

    if (action === "update-task") {
      ["title", "description", "dueDate"].forEach((key) => {
        if (typeof body[key] === "string") update[key] = text(body[key], key === "description" ? 3000 : 180);
      });
      if (STATUSES.includes(body.status)) update.status = body.status;
      if (PRIORITIES.includes(body.priority)) update.priority = body.priority;
      if (body.estimateMinutes !== undefined) update.estimateMinutes = Math.max(0, Math.min(100000, Number(body.estimateMinutes) || 0));
      if (Array.isArray(body.labels)) update.labels = body.labels.slice(0, 12).map((item) => text(item, 32)).filter(Boolean);
      if (body.assigneeId !== undefined) Object.assign(update, resolveAssignee(board, body.assigneeId, body.assignee));
      else if (typeof body.assignee === "string") update.assignee = text(body.assignee, 160);
      if (Array.isArray(body.dependencies)) update.dependencies = await validateDependencies(tasks, board._id, taskId, body.dependencies);
      update = applyStatusAutomation(current, update, board);
    } else if (action === "add-subtask") {
      const title = text(body.title, 180);
      if (!title) throw error("Nhập tên subtask.");
      update.subtasks = [...(current.subtasks || []), { id: token(), title, done: false, assignee: text(body.assignee, 100), dueDate: text(body.dueDate, 32), estimateMinutes: Math.max(0, Math.min(100000, Number(body.estimateMinutes) || 0)), createdBy: safePerson(publicUser(user)), createdAt: now }];
      update = applyStatusAutomation(current, update, board);
      actionSummary = `Thêm subtask vào ${current.title}`;
    } else if (action === "toggle-subtask") {
      const subtaskId = text(body.subtaskId, 40);
      if (!(current.subtasks || []).some((item) => item.id === subtaskId)) throw error("Không tìm thấy subtask.", 404);
      update.subtasks = (current.subtasks || []).map((item) => item.id === subtaskId ? { ...item, done: body.done !== false, completedAt: body.done === false ? null : now } : item);
      update = applyStatusAutomation(current, update, board);
      actionSummary = `Cập nhật subtask của ${current.title}`;
    } else if (action === "remove-subtask") {
      const subtaskId = text(body.subtaskId, 40);
      update.subtasks = (current.subtasks || []).filter((item) => item.id !== subtaskId);
      update = applyStatusAutomation(current, update, board);
      actionSummary = `Xóa subtask khỏi ${current.title}`;
    } else if (action === "set-dependencies") {
      update.dependencies = await validateDependencies(tasks, board._id, taskId, body.dependencies);
      actionSummary = `Cập nhật dependency của ${current.title}`;
    } else if (action === "restore-task-version") {
      const selected = (current.versions || []).find((item) => item.id === text(body.versionId, 40));
      if (!selected?.snapshot) throw error("Không tìm thấy phiên bản cần khôi phục.", 404);
      update = { ...snapshot(selected.snapshot), dependencies: await validateDependencies(tasks, board._id, taskId, selected.snapshot.dependencies), updatedAt: now };
      actionSummary = `Khôi phục ${current.title} về phiên bản ${selected.version}`;
    } else if (action === "delete-task") {
      await tasks.deleteOne(taskQuery);
      await tasks.updateMany({ boardId: board._id }, { $pull: { dependencies: taskId } });
      await boards.updateOne({ _id: board._id }, { $set: { updatedAt: now } });
      await logActivity(activity, req, { boardId: board._id, action, entityType: "task", entityId: taskId, summary: `Xóa công việc ${current.title}`, user, before, reason: body.reason, now });
      return res.status(200).json({ deleted: true, taskId: String(taskId) });
    } else {
      throw error("Action không được hỗ trợ.", 404);
    }

    await tasks.updateOne(taskQuery, { $set: update, $inc: { version: 1 }, $push: { versions: { $each: [history], $slice: -VERSION_LIMIT } } });
    await boards.updateOne({ _id: board._id }, { $set: { updatedAt: now } });
    const updated = await tasks.findOne(taskQuery);
    await logActivity(activity, req, { boardId: board._id, action, entityType: "task", entityId: taskId, summary: actionSummary, user, before, after: snapshot(updated), reason: body.reason, now });
    return res.status(200).json({ task: taskView(updated, { withVersions: action === "restore-task-version" }) });
  });
};
