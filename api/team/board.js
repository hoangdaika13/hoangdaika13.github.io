const { ObjectId } = require("mongodb");
const { clean, currentUser, publicUser, withApi } = require("../../utils/platform");

const token = () => crypto.randomUUID().replaceAll("-", "").slice(0, 20);
const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const text = (value, max = 160) => clean(value, max);

function member(board, user) {
  return (board.members || []).find((item) => String(item.userId) === String(user?._id));
}

function boardView(board, user) {
  return {
    id: String(board._id), name: board.name, description: board.description || "", shareToken: board.ownerId?.equals?.(user._id) ? board.shareToken : undefined,
    role: member(board, user)?.role || "viewer", members: (board.members || []).map((item) => ({ ...item, userId: String(item.userId) })),
    createdAt: board.createdAt, updatedAt: board.updatedAt
  };
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const user = await currentUser(req);
    if (!user) throw error("Đăng nhập để dùng không gian nhóm.", 401);
    const boards = db.collection("teamBoards");
    const tasks = db.collection("teamBoardTasks");
    const action = text(body.action || req.query.action, 40);
    const boardId = text(body.boardId || req.query.boardId, 64);

    if (req.method === "GET") {
      if (!ObjectId.isValid(boardId)) throw error("Board không hợp lệ.");
      const board = await boards.findOne({ _id: new ObjectId(boardId) });
      if (!board || !member(board, user)) throw error("Bạn chưa có quyền truy cập board này.", 403);
      const records = await tasks.find({ boardId: board._id }).sort({ updatedAt: -1 }).limit(300).toArray();
      return res.status(200).json({ board: boardView(board, user), tasks: records.map((item) => ({ ...item, _id: String(item._id), boardId: String(item.boardId) })) });
    }
    if (req.method !== "POST") throw error("Method not allowed", 405);

    if (action === "create-board") {
      const now = new Date();
      const board = { name: text(body.name || "Nhóm HH", 100), description: text(body.description, 360), ownerId: user._id, shareToken: token(), members: [{ userId: user._id, ...publicUser(user), role: "owner", joinedAt: now }], createdAt: now, updatedAt: now };
      const result = await boards.insertOne(board);
      return res.status(201).json({ board: boardView({ ...board, _id: result.insertedId }, user) });
    }
    if (action === "join-board") {
      if (!ObjectId.isValid(boardId) || !text(body.shareToken, 80)) throw error("Thiếu mã tham gia board.");
      const board = await boards.findOne({ _id: new ObjectId(boardId), shareToken: text(body.shareToken, 80) });
      if (!board) throw error("Liên kết chia sẻ không hợp lệ hoặc đã hết hạn.", 404);
      if (!member(board, user)) await boards.updateOne({ _id: board._id }, { $push: { members: { userId: user._id, ...publicUser(user), role: "editor", joinedAt: new Date() } }, $set: { updatedAt: new Date() } });
      const updated = await boards.findOne({ _id: board._id });
      return res.status(200).json({ board: boardView(updated, user) });
    }
    if (!ObjectId.isValid(boardId)) throw error("Board không hợp lệ.");
    const board = await boards.findOne({ _id: new ObjectId(boardId) });
    const access = member(board, user);
    if (!board || !access) throw error("Bạn chưa có quyền truy cập board này.", 403);
    if (access.role === "viewer") throw error("Bạn chỉ có quyền xem board này.", 403);
    const now = new Date();
    if (action === "create-task") {
      const task = { boardId: board._id, title: text(body.title, 180), description: text(body.description, 3000), status: ["todo", "doing", "done"].includes(body.status) ? body.status : "todo", priority: ["low", "normal", "high", "urgent"].includes(body.priority) ? body.priority : "normal", assignee: text(body.assignee, 160), dueDate: text(body.dueDate, 32), labels: Array.isArray(body.labels) ? body.labels.slice(0, 8).map((item) => text(item, 32)) : [], createdBy: publicUser(user), comments: [], createdAt: now, updatedAt: now };
      if (!task.title) throw error("Nhập tên công việc.");
      const result = await tasks.insertOne(task); return res.status(201).json({ task: { ...task, _id: String(result.insertedId), boardId: String(board._id) } });
    }
    if (!ObjectId.isValid(text(body.taskId, 64))) throw error("Công việc không hợp lệ.");
    const taskQuery = { _id: new ObjectId(text(body.taskId, 64)), boardId: board._id };
    if (action === "update-task") { const update = { updatedAt: now }; ["title", "description", "assignee", "dueDate"].forEach((key) => { if (typeof body[key] === "string") update[key] = text(body[key], key === "description" ? 3000 : 180); }); if (["todo", "doing", "done"].includes(body.status)) update.status = body.status; if (["low", "normal", "high", "urgent"].includes(body.priority)) update.priority = body.priority; await tasks.updateOne(taskQuery, { $set: update }); }
    if (action === "comment") { const value = text(body.comment, 1200); if (!value) throw error("Bình luận đang trống."); await tasks.updateOne(taskQuery, { $push: { comments: { id: token(), text: value, author: publicUser(user), createdAt: now } }, $set: { updatedAt: now } }); }
    const task = await tasks.findOne(taskQuery); await boards.updateOne({ _id: board._id }, { $set: { updatedAt: now } });
    return res.status(200).json({ task: { ...task, _id: String(task._id), boardId: String(task.boardId) } });
  });
};
