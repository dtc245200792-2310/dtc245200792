const express = require('express');
const client = require('prom-client');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: 'pm.sid',
  secret: process.env.SESSION_SECRET || 'local-development-secret-change-before-deploy',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 },
}));

// 1. Prometheus Metrics Setup
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// 2. PostgreSQL Connection Pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  user: process.env.POSTGRES_USER || 'app_user',
  password: process.env.POSTGRES_PASSWORD || 'SecurePassword123!',
  database: process.env.POSTGRES_DB || 'project_db',
  port: 5432,
});

const taskStatuses = ['To Do', 'In Progress', 'Done'];
const taskPriorities = ['Low', 'Medium', 'High'];
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const isId = value => /^\d+$/.test(String(value || ''));
const validDate = value => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
const page = (title, body) => `<!doctype html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet"><style>
  :root{--ink:#172b4d;--muted:#65758b;--line:#dce3eb;--canvas:#f4f6f8;--blue:#1769aa;--green:#16845b;--red:#b42332}*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font-family:"Segoe UI",Tahoma,sans-serif}.topbar{min-height:62px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:10px 24px;gap:16px}.brand{font-size:18px;font-weight:700}.brand i{color:var(--blue);margin-right:10px}main{max-width:1500px;margin:0 auto;padding:24px}.page-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px}h1{font-size:26px;margin:0 0 5px;font-weight:700}.subtitle,.muted{color:var(--muted);font-size:14px}.primary-button{background:var(--blue);border:0;border-radius:5px;color:white;padding:10px 15px;font-weight:600}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:20px}.summary-item,.panel{background:#fff;border:1px solid var(--line);border-radius:6px;padding:14px 16px}.summary-item{display:flex;justify-content:space-between;align-items:center}.summary-item span{font-size:13px;color:var(--muted)}.summary-item strong{font-size:22px}.toolbar{display:flex;gap:10px;align-items:center;margin-bottom:16px}.toolbar input,.toolbar select{min-height:38px;border:1px solid var(--line);border-radius:5px;background:#fff;padding:6px 10px}.toolbar input{flex:1;max-width:420px}.board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:start}.kanban-column{background:#e9edf2;border-radius:6px;padding:12px;min-height:260px;border-top:3px solid #8995a4}.column-progress{border-color:var(--blue)}.column-done{border-color:var(--green)}.column-header{display:flex;justify-content:space-between;align-items:center;padding:3px 3px 12px}.column-header h2{font-size:14px;font-weight:700;margin:0}.task-card{background:#fff;border:1px solid #e0e5eb;border-radius:5px;padding:13px;margin-bottom:10px}.task-card h3{font-size:15px;line-height:1.4;margin:10px 0 5px}.task-topline,.task-actions,.task-meta{display:flex;align-items:center;justify-content:space-between;gap:8px}.task-meta{font-size:12px;color:var(--muted);flex-wrap:wrap}.priority{font-size:11px;font-weight:700;padding:4px 7px;border-radius:3px}.priority-high{background:#ffebe8;color:#ae2e24}.priority-medium{background:#fff4d6;color:#8c6100}.priority-low{background:#e3fcef;color:#216e4e}.overdue{color:var(--red)!important;font-weight:700}.task-actions{border-top:1px solid #edf0f3;margin-top:11px;padding-top:8px}.status-form{display:flex;align-items:center;gap:5px}.status-select{border:0;background:#f2f4f7;border-radius:4px;padding:5px 7px}.icon-button{border:0;background:transparent;color:#6f7f91;padding:5px 7px}.delete-button:hover{color:var(--red)}.project-progress{height:12px;background:#e5eaf0;border-radius:8px;overflow:hidden}.project-progress>span{display:block;height:100%;background:var(--green);transition:width .25s}.activity-list{padding:0;margin:0;list-style:none}.activity-list li{padding:9px 0;border-bottom:1px solid #edf0f3;font-size:13px}.activity-list li:last-child{border:0}.empty-state{text-align:center;color:#8290a0;padding:28px 10px}.section-heading{display:flex;justify-content:space-between;align-items:center;margin:24px 0 10px}.section-heading h2{font-size:17px;margin:0}.panel-title{font-size:16px;font-weight:700;margin:0 0 12px}@media(max-width:900px){.board{grid-template-columns:1fr}.summary{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){main{padding:16px}.topbar{padding:10px 16px;align-items:flex-start}.page-heading{flex-direction:column}.toolbar{align-items:stretch;flex-direction:column}.toolbar input{max-width:none}.summary-item{padding:11px}.summary-item span{font-size:12px}.summary-item strong{font-size:19px}}
  </style></head><body>${body}</body></html>`;
const renderMenu = user => `<header class="topbar"><a class="brand text-decoration-none" href="/"><i class="fa-solid fa-list-check"></i>Quản lý dự án</a><nav class="nav nav-pills" aria-label="Điều hướng chính"><a class="nav-link" href="/">Dự án</a>${user.role === 'admin' ? '<a class="nav-link" href="/accounts">Quản lý tài khoản</a>' : ''}</nav><div class="d-flex align-items-center gap-3"><span>${escapeHtml(user.username)} · ${user.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</span><form method="POST" action="/logout"><button class="btn btn-sm btn-outline-secondary" type="submit"><i class="fa-solid fa-arrow-right-from-bracket"></i> Đăng xuất</button></form></div></header>`;

const initDb = async () => {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await pool.query(`
        DO $migration$ BEGIN
          IF to_regclass('public.projects') IS NOT NULL
             AND to_regclass('public.tasks') IS NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'assignee') THEN
            ALTER SEQUENCE IF EXISTS projects_id_seq RENAME TO tasks_id_seq;
            ALTER TABLE projects RENAME TO tasks;
          END IF;
        END $migration$;
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(32) NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
        CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          project_id INTEGER REFERENCES projects(id),
          title VARCHAR(255) NOT NULL,
          assignee VARCHAR(100) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'To Do',
          description TEXT NOT NULL DEFAULT '',
          priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
          due_date DATE,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id);
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'Medium';
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;
        CREATE TABLE IF NOT EXISTS activity_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
          task_id INTEGER,
          action VARCHAR(80) NOT NULL,
          details TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const userCount = await pool.query('SELECT COUNT(*)::int AS count FROM users');
      if (!userCount.rows[0].count) {
        const username = process.env.ADMIN_USERNAME || 'admin';
        const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
        await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [username, await bcrypt.hash(password, 12), 'admin']);
      }
      let project = (await pool.query('SELECT id FROM projects ORDER BY id LIMIT 1')).rows[0];
      if (!project) project = (await pool.query('INSERT INTO projects (title, description) VALUES ($1, $2) RETURNING id', ['Dự án hiện tại', 'Dự án được tạo khi nâng cấp dữ liệu cũ.'])).rows[0];
      await pool.query('UPDATE tasks SET project_id = $1 WHERE project_id IS NULL', [project.id]);
      await pool.query('ALTER TABLE tasks ALTER COLUMN project_id SET NOT NULL');
      const taskCount = await pool.query('SELECT COUNT(*)::int AS count FROM tasks');
      if (!taskCount.rows[0].count) await pool.query(`INSERT INTO tasks (project_id, title, assignee, status, priority) VALUES ($1, 'Thiết kế giao diện Dashboard', 'Đỗ Bình An', 'In Progress', 'High'), ($1, 'Cấu hình Nginx & SSL Security', 'Nguyễn Văn A', 'Done', 'Medium'), ($1, 'Tích hợp Prometheus & Grafana', 'Đỗ Bình An', 'To Do', 'Low')`, [project.id]);
      console.log('Database schema is ready');
      return;
    } catch (err) {
      console.error(`Database initialization attempt ${attempt}/30 failed: ${err.message}`);
      if (attempt === 30) throw err;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};

const validTask = ({ title, assignee, status, priority }) =>
  typeof title === 'string' && title.trim().length > 0 && title.trim().length <= 255 &&
  typeof assignee === 'string' && assignee.trim().length > 0 && assignee.trim().length <= 100 &&
  taskStatuses.includes(status) && taskPriorities.includes(priority);

app.use((req, res, next) => {
  if (req.path === '/metrics' || req.path === '/login') return next();
  if (!req.session.user) return res.redirect('/login');
  pool.query('SELECT role, is_active FROM users WHERE id = $1', [req.session.user.id]).then(result => {
    const user = result.rows[0];
    if (!user || !user.is_active) return req.session.destroy(() => res.redirect('/login'));
    req.session.user.role = user.role;
    next();
  }).catch(next);
});

const requireAdmin = (req, res, next) => req.session.user?.role === 'admin' ? next() : res.status(403).send('Bạn không có quyền thực hiện thao tác này.');
const logActivity = (userId, projectId, taskId, action, details) => pool.query(
  'INSERT INTO activity_logs (user_id, project_id, task_id, action, details) VALUES ($1, $2, $3, $4, $5)',
  [userId, projectId, taskId, action, details]
);

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.send(page('Đăng nhập | Quản lý dự án', `
    <style>
      .login-page{position:relative;isolation:isolate;min-height:100vh;max-width:none;margin:0;padding:40px 20px;display:grid;place-items:center;overflow:hidden;background-color:#edf3f5;background-image:linear-gradient(#d9e4e933 1px,transparent 1px),linear-gradient(90deg,#d9e4e933 1px,transparent 1px),linear-gradient(135deg,#f7fafb,#eaf2f3);background-size:32px 32px,32px 32px,auto}
      .login-card{position:relative;overflow:hidden;width:min(100%,440px);padding:34px 32px 30px;border:1px solid #d9e3e9;border-radius:12px;background:#ffffffed;box-shadow:0 22px 60px #18384d1c,0 2px 8px #18384d0a}
      .login-card:before{content:"";position:absolute;inset:0 0 auto;height:4px;background:linear-gradient(90deg,#1769aa,#168b83,#d96658)}
      .login-brand{display:flex;align-items:center;gap:12px;margin-bottom:25px}.login-mark{width:44px;height:44px;display:grid;place-items:center;border-radius:10px;background:linear-gradient(145deg,#1769aa,#168b83);color:#fff;font-size:18px;box-shadow:0 5px 12px #1769aa35}.login-brand-label{font-size:11px;font-weight:700;letter-spacing:1px;color:#168b83}.login-card h1{font-size:27px;margin:0 0 5px;font-weight:750}.login-card .login-subtitle{margin:0 0 24px;color:#65758b;font-size:14px}
      .login-card .form-label{margin-bottom:7px;color:#263b52;font-size:13px;font-weight:650}.login-card .form-control{height:46px;border-color:#d8e1e8;border-radius:7px;padding:10px 12px;color:#172b4d}.login-card .form-control:focus{border-color:#168b83;box-shadow:0 0 0 3px #168b831f}.login-submit{height:46px;border:0;border-radius:7px;background:linear-gradient(100deg,#1769aa,#147d87);font-weight:650;box-shadow:0 5px 12px #1769aa28;transition:transform .15s,box-shadow .15s}.login-submit:hover{background:linear-gradient(100deg,#145b96,#116e78);transform:translateY(-1px);box-shadow:0 8px 16px #1769aa35}
      .login-error{padding:10px 12px;border:1px solid #f1c9c5;border-radius:7px;background:#fff3f1;color:#a7352b;font-size:13px}
      @media(max-width:480px){.login-page{padding:20px 16px}.login-card{padding:29px 22px 24px}}
    </style>
    <main class="login-page"><section class="panel login-card" aria-labelledby="login-title">
      <div class="login-brand"><span class="login-mark" aria-hidden="true"><i class="fa-solid fa-diagram-project"></i></span><span class="login-brand-label">PROJECT WORKSPACE</span></div>
      <h1 id="login-title">Đăng nhập</h1><p class="login-subtitle">Hệ thống quản lý dự án</p>
      ${req.query.error ? '<p class="login-error" role="alert"><i class="fa-solid fa-circle-exclamation me-2"></i>Tên đăng nhập hoặc mật khẩu không đúng.</p>' : ''}
      <form method="POST" action="/login"><div class="mb-3"><label class="form-label" for="username">Tên đăng nhập</label><input id="username" name="username" class="form-control" autocomplete="username" required></div><div class="mb-4"><label class="form-label" for="password">Mật khẩu</label><input id="password" name="password" type="password" class="form-control" autocomplete="current-password" required></div><button class="btn btn-primary login-submit w-100" type="submit">Đăng nhập <i class="fa-solid fa-arrow-right ms-2"></i></button></form>
    </section></main>`));
});

app.post('/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const userResult = await pool.query('SELECT id, username, password_hash, role, is_active FROM users WHERE username = $1', [username]);
  const user = userResult.rows[0];
  if (!user || !user.is_active || !(await bcrypt.compare(String(req.body.password || ''), user.password_hash))) return res.redirect('/login?error=1');
  req.session.regenerate(error => {
    if (error) return res.status(500).send('Không thể tạo phiên đăng nhập.');
    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.redirect('/');
  });
});

app.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

app.post('/api/users', requireAdmin, async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const role = 'member';
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username) || password.length < 10) return res.status(400).send('Tên đăng nhập phải dài 3-32 ký tự; mật khẩu tối thiểu 10 ký tự.');
  try {
    await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [username, await bcrypt.hash(password, 12), role]);
    res.redirect('/accounts');
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).send(error.code === '23505' ? 'Tên đăng nhập đã tồn tại.' : 'Không thể tạo tài khoản.');
  }
});

app.post('/api/users/:id/status', requireAdmin, async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).send('Mã tài khoản không hợp lệ.');
  const active = req.body.action === 'unlock';
  if (!['lock', 'unlock'].includes(req.body.action)) return res.status(400).send('Trạng thái tài khoản không hợp lệ.');
  if (Number(req.params.id) === req.session.user.id) return res.status(400).send('Không thể khóa tài khoản đang đăng nhập.');
  const result = await pool.query('UPDATE users SET is_active = $1 WHERE id = $2 AND role = $3 RETURNING username', [active, req.params.id, 'member']);
  if (!result.rowCount) return res.status(404).send('Không tìm thấy tài khoản thành viên.');
  res.redirect('/accounts');
});

app.post('/api/users/:id/delete', requireAdmin, async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).send('Mã tài khoản không hợp lệ.');
  if (Number(req.params.id) === req.session.user.id) return res.status(400).send('Không thể xóa tài khoản đang đăng nhập.');
  const result = await pool.query('DELETE FROM users WHERE id = $1 AND role = $2 RETURNING username', [req.params.id, 'member']);
  if (!result.rowCount) return res.status(404).send('Không tìm thấy tài khoản thành viên.');
  res.redirect('/accounts');
});

app.get('/accounts', requireAdmin, async (req, res) => {
  const users = (await pool.query('SELECT id, username, is_active, created_at FROM users WHERE role = $1 ORDER BY username', ['member'])).rows;
  const rows = users.map(user => `<tr><td>${escapeHtml(user.username)}</td><td>${user.is_active ? '<span class="badge text-bg-success">Đang hoạt động</span>' : '<span class="badge text-bg-secondary">Đã khóa</span>'}</td><td>${new Date(user.created_at).toLocaleDateString('vi-VN')}</td><td><div class="d-flex gap-2"><form method="POST" action="/api/users/${user.id}/status"><input type="hidden" name="action" value="${user.is_active ? 'lock' : 'unlock'}"><button class="btn btn-sm ${user.is_active ? 'btn-outline-warning' : 'btn-outline-success'}" type="submit"><i class="fa-solid ${user.is_active ? 'fa-lock' : 'fa-lock-open'}"></i> ${user.is_active ? 'Khóa' : 'Mở khóa'}</button></form><form method="POST" action="/api/users/${user.id}/delete" onsubmit="return confirm('Xóa tài khoản ${escapeHtml(user.username)}?')"><button class="btn btn-sm btn-outline-danger" type="submit"><i class="fa-regular fa-trash-can"></i> Xóa</button></form></div></td></tr>`).join('');
  res.send(page('Quản lý tài khoản', `${renderMenu(req.session.user)}<main><div class="page-heading"><div><h1>Quản lý tài khoản</h1><div class="subtitle">Tạo, khóa hoặc xóa tài khoản thành viên.</div></div></div><section class="panel mb-4"><h2 class="panel-title">Tạo tài khoản thành viên</h2><form class="row g-2" method="POST" action="/api/users"><div class="col-sm"><label class="form-label" for="newUsername">Tên đăng nhập</label><input id="newUsername" class="form-control" name="username" pattern="[a-zA-Z0-9_.-]{3,32}" minlength="3" maxlength="32" required></div><div class="col-sm"><label class="form-label" for="newPassword">Mật khẩu</label><input id="newPassword" class="form-control" type="password" name="password" minlength="10" required></div><div class="col-sm-auto align-self-end"><button class="btn btn-primary" type="submit"><i class="fa-solid fa-user-plus"></i> Tạo tài khoản</button></div></form></section><section class="panel"><h2 class="panel-title">Tài khoản thành viên</h2><div class="table-responsive"><table class="table align-middle"><thead><tr><th>Tên đăng nhập</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="text-center text-secondary py-4">Chưa có tài khoản thành viên.</td></tr>'}</tbody></table></div></section></main>`));
});

app.post('/api/projects', requireAdmin, async (req, res) => {
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  if (!title || title.length > 255 || description.length > 2000) return res.status(400).send('Thông tin dự án không hợp lệ.');
  const project = await pool.query('INSERT INTO projects (title, description, created_by) VALUES ($1, $2, $3) RETURNING id', [title, description, req.session.user.id]);
  await logActivity(req.session.user.id, project.rows[0].id, null, 'Tạo dự án', title);
  res.redirect(`/?project=${project.rows[0].id}`);
});

app.post('/api/projects/:id', requireAdmin, async (req, res) => {
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  if (!isId(req.params.id) || !title || title.length > 255 || description.length > 2000) {
    return res.status(400).send('Thông tin dự án không hợp lệ.');
  }
  try {
    const result = await pool.query('UPDATE projects SET title = $1, description = $2 WHERE id = $3 RETURNING id', [title, description, req.params.id]);
    if (!result.rowCount) return res.status(404).send('Không tìm thấy dự án.');
    await logActivity(req.session.user.id, Number(req.params.id), null, 'Cập nhật dự án', title);
    res.redirect(`/?project=${req.params.id}`);
  } catch (error) {
    res.status(500).send('Không thể cập nhật dự án.');
  }
});

app.post('/api/projects/:id/delete', requireAdmin, async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).send('Mã dự án không hợp lệ.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const project = await client.query('SELECT title FROM projects WHERE id = $1', [req.params.id]);
    if (!project.rowCount) { await client.query('ROLLBACK'); return res.status(404).send('Không tìm thấy dự án.'); }
    const projectCount = await client.query('SELECT COUNT(*)::int AS count FROM projects');
    if (projectCount.rows[0].count <= 1) {
      await client.query('ROLLBACK');
      return res.status(400).send('Không thể xóa dự án cuối cùng.');
    }
    await client.query('DELETE FROM activity_logs WHERE project_id = $1', [req.params.id]);
    await client.query('DELETE FROM tasks WHERE project_id = $1', [req.params.id]);
    await client.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.redirect('/');
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).send('Không thể xóa dự án.');
  } finally { client.release(); }
});

app.post('/api/tasks', async (req, res) => {
  const { title, assignee, status = 'To Do', priority = 'Medium', description = '', due_date = '', project_id: projectId } = req.body;
  if (!validTask({ title, assignee, status, priority })) {
    return res.status(400).send('Vui lòng nhập tên công việc, người thực hiện và giá trị hợp lệ.');
  }
  if (!isId(projectId) || !validDate(due_date) || String(description).length > 2000) return res.status(400).send('Thông tin dự án, mô tả hoặc hạn hoàn thành không hợp lệ.');
  try {
    const result = await pool.query(
      'INSERT INTO tasks (project_id, title, assignee, status, priority, description, due_date) SELECT id, $2, $3, $4, $5, $6, $7 FROM projects WHERE id = $1 RETURNING id',
      [projectId, title.trim(), assignee.trim(), status, priority, String(description).trim(), due_date || null]
    );
    if (!result.rowCount) return res.status(404).send('Không tìm thấy dự án.');
    await logActivity(req.session.user.id, Number(projectId), result.rows[0].id, 'Tạo công việc', title.trim());
    res.redirect(`/?project=${projectId}`);
  } catch (err) {
    res.status(500).send('Không thể thêm công việc.');
  }
});

app.post('/api/tasks/:id', async (req, res) => {
  const { title, assignee, status, priority, description = '', due_date = '', project_id: projectId } = req.body;
  if (!isId(req.params.id) || !isId(projectId) || !validTask({ title, assignee, status, priority }) || !validDate(due_date) || String(description).length > 2000) {
    return res.status(400).send('Thông tin công việc không hợp lệ.');
  }
  try {
    const result = await pool.query(
      'UPDATE tasks SET title = $1, assignee = $2, status = $3, priority = $4, description = $5, due_date = $6 WHERE id = $7 AND project_id = $8',
      [title.trim(), assignee.trim(), status, priority, String(description).trim(), due_date || null, req.params.id, projectId]
    );
    if (!result.rowCount) return res.status(404).send('Không tìm thấy công việc.');
    await logActivity(req.session.user.id, Number(projectId), Number(req.params.id), 'Cập nhật công việc', title.trim());
    res.redirect(`/?project=${projectId}`);
  } catch (err) {
    res.status(500).send('Không thể cập nhật công việc.');
  }
});

app.post('/api/tasks/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!isId(req.params.id) || !isId(req.body.project_id) || !taskStatuses.includes(status)) {
    return res.status(400).send('Trạng thái công việc không hợp lệ.');
  }
  try {
    const result = await pool.query('UPDATE tasks SET status = $1 WHERE id = $2 AND project_id = $3 RETURNING title', [status, req.params.id, req.body.project_id]);
    if (!result.rowCount) return res.status(404).send('Không tìm thấy công việc.');
    await logActivity(req.session.user.id, Number(req.body.project_id), Number(req.params.id), 'Đổi trạng thái', `${result.rows[0].title}: ${status}`);
    res.redirect(`/?project=${req.body.project_id}`);
  } catch (err) {
    res.status(500).send('Lỗi khi cập nhật trạng thái: ' + escapeHtml(err.message));
  }
});

app.post('/api/tasks/delete/:id', async (req, res) => {
  if (!isId(req.params.id) || !isId(req.body.project_id)) return res.status(400).send('Mã công việc không hợp lệ.');
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 AND project_id = $2 RETURNING title', [req.params.id, req.body.project_id]);
    if (!result.rowCount) return res.status(404).send('Không tìm thấy công việc.');
    await logActivity(req.session.user.id, Number(req.body.project_id), Number(req.params.id), 'Xóa công việc', result.rows[0].title);
    res.redirect(`/?project=${req.body.project_id}`);
  } catch (err) {
    res.status(500).send('Lỗi khi xóa công việc: ' + escapeHtml(err.message));
  }
});

app.get('/projects/:id/export.csv', async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).send('Mã dự án không hợp lệ.');
  const project = await pool.query('SELECT title FROM projects WHERE id = $1', [req.params.id]);
  if (!project.rowCount) return res.status(404).send('Không tìm thấy dự án.');
  const tasks = await pool.query('SELECT title, assignee, status, priority, description, due_date::text AS due_date FROM tasks WHERE project_id = $1 ORDER BY created_at, id', [req.params.id]);
  const csvCell = value => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows = [['Công việc', 'Người thực hiện', 'Trạng thái', 'Ưu tiên', 'Mô tả', 'Hạn hoàn thành'], ...tasks.rows.map(task => [task.title, task.assignee, task.status, task.priority, task.description, task.due_date])];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="project-${req.params.id}-tasks.csv"`);
  res.send(`\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`);
});

app.get('/', async (req, res) => {
  let projects = [];
  let tasks = [];
  let activities = [];
  let dbStatus = 'Connected';
  try {
    projects = (await pool.query(`SELECT p.*, COUNT(t.id)::int AS task_count,
      COUNT(t.id) FILTER (WHERE t.status = 'Done')::int AS completed_count
      FROM projects p LEFT JOIN tasks t ON t.project_id = p.id
      GROUP BY p.id ORDER BY p.created_at DESC, p.id DESC`)).rows;
    let selectedProjectId = isId(req.query.project) ? Number(req.query.project) : null;
    if (!projects.some(project => project.id === selectedProjectId)) selectedProjectId = null;
    if (selectedProjectId) {
      tasks = (await pool.query('SELECT * FROM tasks WHERE project_id = $1 ORDER BY due_date NULLS LAST, created_at DESC', [selectedProjectId])).rows;
      activities = (await pool.query('SELECT a.*, u.username FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id WHERE a.project_id = $1 ORDER BY a.created_at DESC LIMIT 12', [selectedProjectId])).rows;
    }
    res.locals.selectedProjectId = selectedProjectId;
  } catch (err) {
    dbStatus = 'Error: ' + err.message;
  }

  const counts = Object.fromEntries(taskStatuses.map(status => [status, tasks.filter(task => task.status === status).length]));
  const completion = tasks.length ? Math.round((counts.Done / tasks.length) * 100) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const dueDateValue = value => value ? (typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10)) : '';
  const overdueCount = tasks.filter(task => dueDateValue(task.due_date) && dueDateValue(task.due_date) < today && task.status !== 'Done').length;
  const renderTask = task => {
    const dueDate = dueDateValue(task.due_date);
    const dueLabel = dueDate ? new Date(`${dueDate}T00:00:00`).toLocaleDateString('vi-VN') : 'Chưa đặt hạn';
    const priorityClass = { High: 'priority-high', Medium: 'priority-medium', Low: 'priority-low' }[task.priority] || 'priority-medium';
    return `
      <article class="task-card" data-search="${escapeHtml(`${task.title} ${task.assignee} ${task.description}`.toLowerCase())}" data-priority="${escapeHtml(task.priority)}">
        <div class="task-topline"><span class="priority ${priorityClass}">${escapeHtml(task.priority === 'High' ? 'Ưu tiên cao' : task.priority === 'Low' ? 'Ưu tiên thấp' : 'Ưu tiên vừa')}</span>
          <button class="icon-button edit-task" type="button" title="Sửa công việc" aria-label="Sửa công việc"
            data-id="${task.id}" data-project-id="${task.project_id}" data-title="${escapeHtml(task.title)}" data-assignee="${escapeHtml(task.assignee)}"
            data-status="${escapeHtml(task.status)}" data-priority="${escapeHtml(task.priority)}" data-due-date="${dueDate}"
            data-description="${escapeHtml(task.description)}"><i class="fa-solid fa-pen"></i></button>
        </div>
        <h3>${escapeHtml(task.title)}</h3>
        ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
        <div class="task-meta"><span><i class="fa-regular fa-user"></i>${escapeHtml(task.assignee)}</span>
          <span class="${dueDate && dueDate < today && task.status !== 'Done' ? 'overdue' : ''}"><i class="fa-regular fa-calendar"></i>${dueLabel}</span></div>
        <div class="task-actions">
          <form action="/api/tasks/${task.id}/status" method="POST" class="status-form"><input type="hidden" name="project_id" value="${task.project_id}">
            <label class="visually-hidden" for="status-${task.id}">Trạng thái</label>
            <select id="status-${task.id}" name="status" class="status-select" aria-label="Trạng thái công việc">
              ${taskStatuses.map(status => `<option value="${status}" ${task.status === status ? 'selected' : ''}>${status === 'To Do' ? 'Cần làm' : status === 'In Progress' ? 'Đang làm' : 'Hoàn thành'}</option>`).join('')}
            </select><button class="icon-button" type="submit" title="Cập nhật trạng thái" aria-label="Cập nhật trạng thái"><i class="fa-solid fa-arrow-right"></i></button>
          </form>
          <form action="/api/tasks/delete/${task.id}" method="POST" onsubmit="return confirm('Xóa công việc này?')"><input type="hidden" name="project_id" value="${task.project_id}">
            <button class="icon-button delete-button" type="submit" title="Xóa công việc" aria-label="Xóa công việc"><i class="fa-regular fa-trash-can"></i></button>
          </form>
        </div>
      </article>`;
  };
  const renderColumn = (status, title, icon, color) => `
    <section class="kanban-column column-${color}">
      <header class="column-header"><h2><i class="${icon}"></i>${title}</h2><span>${counts[status]}</span></header>
      <div class="task-list">${tasks.filter(task => task.status === status).map(renderTask).join('') || '<p class="empty-state">Chưa có công việc</p>'}</div>
    </section>`;
  const selectedProjectId = res.locals.selectedProjectId;
  const selectedProject = projects.find(project => project.id === selectedProjectId);
  const renderActivity = activity => `<li><strong>${escapeHtml(activity.username || 'Tài khoản đã xóa')}</strong> ${escapeHtml(activity.action)}: ${escapeHtml(activity.details)} <span class="muted">· ${new Date(activity.created_at).toLocaleString('vi-VN')}</span></li>`;
  const renderProject = project => {
    const progress = project.task_count ? Math.round((project.completed_count / project.task_count) * 100) : 0;
    return `<a class="project-tile" href="/?project=${project.id}"><div class="project-tile-heading"><h2>${escapeHtml(project.title)}</h2><i class="fa-solid fa-arrow-right"></i></div><p>${escapeHtml(project.description || 'Chưa có mô tả')}</p><div class="project-progress" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress}%"></span></div><div class="project-tile-meta"><strong>${progress}% hoàn thành</strong><span>${project.completed_count}/${project.task_count} công việc</span></div></a>`;
  };

  res.send(`
    <!doctype html><html lang="vi"><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Quản lý dự án | Đề 14</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <style>
        :root{--ink:#172b4d;--muted:#65758b;--line:#dce3eb;--paper:#fff;--canvas:#f4f6f8;--blue:#1769aa;--green:#16845b;--teal:#168b83;--coral:#d96658;--amber:#b67b16;--red:#b42332}
        *{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 8% 0%,#e5f5f1 0,transparent 32%),radial-gradient(ellipse at 92% 0%,#fff0e8 0,transparent 25%),var(--canvas);color:var(--ink);font-family:"Segoe UI",Tahoma,sans-serif}
        .topbar{position:relative;height:62px;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 2px 10px #172b4d0a;display:flex;align-items:center;justify-content:space-between;padding:0 24px}
        .topbar:after{content:"";position:absolute;inset:auto 0 -1px;height:2px;background:linear-gradient(90deg,var(--blue),var(--teal),var(--coral),var(--amber))}.topbar .nav-link{border-radius:5px;color:var(--muted);padding:8px 12px}.topbar .nav-link:hover{background:#eef7f6;color:var(--teal)}
        .brand{font-size:18px;font-weight:700}.brand i{color:var(--blue);margin-right:10px}.db-state{font-size:12px;color:${dbStatus === 'Connected' ? 'var(--green)' : 'var(--red)'}}
        main{max-width:1500px;margin:0 auto;padding:24px}.page-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px}
        h1{font-size:26px;margin:0 0 5px;font-weight:700}.subtitle{color:var(--muted);font-size:14px}.primary-button{background:var(--blue);border:0;border-radius:5px;color:white;padding:10px 15px;font-weight:600}.page-actions{align-items:stretch}.page-actions>.btn,.page-actions>button,.page-actions>form>.btn{height:44px;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;padding:0 14px}.project-back{flex:none}
        .summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:20px}.summary-item{background:#fff;border:1px solid var(--line);border-radius:6px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center}
        .project-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}.project-tile{--tile-accent:var(--blue);display:block;background:#fff;border:1px solid var(--line);border-top:3px solid var(--tile-accent);border-radius:6px;padding:18px;color:var(--ink);text-decoration:none;box-shadow:0 3px 12px #172b4d0a;transition:border-color .15s,transform .15s,box-shadow .15s}.project-tile:nth-child(4n+2){--tile-accent:var(--teal)}.project-tile:nth-child(4n+3){--tile-accent:var(--coral)}.project-tile:nth-child(4n){--tile-accent:var(--amber)}.project-tile:hover{border-color:var(--tile-accent);transform:translateY(-2px);box-shadow:0 7px 18px #172b4d16;color:var(--ink)}.project-tile-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.project-tile h2{font-size:17px;font-weight:700;margin:0 0 8px}.project-tile-heading i{color:var(--tile-accent);margin-top:4px}.project-tile p{min-height:40px;color:var(--muted);font-size:13px;margin:0 0 14px}.project-progress{height:8px;background:#e5eaf0;border-radius:8px;overflow:hidden}.project-progress span{display:block;height:100%;background:var(--tile-accent)}.project-tile-meta{display:flex;justify-content:space-between;gap:8px;margin-top:10px;font-size:12px}.project-tile-meta span{color:var(--muted)}
        .summary-item span{font-size:13px;color:var(--muted)}.summary-item strong{font-size:22px}.summary-item.alert-count strong{color:var(--red)}
        .toolbar{display:flex;gap:10px;align-items:center;margin-bottom:16px}.search-box{position:relative;flex:1;max-width:420px}.search-box i{position:absolute;left:12px;top:12px;color:#8391a2}.search-box input,.toolbar select{height:38px;border:1px solid var(--line);border-radius:5px;background:#fff;color:var(--ink);padding:0 12px}.search-box input{width:100%;padding-left:35px}.toolbar select{min-width:150px}
        .board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:start}.kanban-column{background:#e9edf2;border-radius:6px;padding:12px;min-height:390px;border-top:3px solid #8995a4}.column-progress{border-color:var(--blue)}.column-done{border-color:var(--green)}
        .column-header{display:flex;justify-content:space-between;align-items:center;padding:3px 3px 12px}.column-header h2{font-size:14px;font-weight:700;margin:0}.column-header i{margin-right:8px}.column-header span{font-size:12px;background:#fff;border-radius:12px;padding:2px 8px;color:var(--muted)}
        .task-card{background:#fff;border:1px solid #e0e5eb;border-radius:5px;padding:13px;margin-bottom:10px;box-shadow:0 1px 2px #172b4d0d}.task-topline,.task-meta,.task-actions,.status-form{display:flex;align-items:center;justify-content:space-between}.task-card h3{font-size:15px;line-height:1.4;margin:10px 0 5px;font-weight:650}.task-description{font-size:13px;color:var(--muted);margin:0 0 10px;white-space:pre-wrap}.priority{font-size:11px;font-weight:700;padding:4px 7px;border-radius:3px}.priority-high{background:#ffebe8;color:#ae2e24}.priority-medium{background:#fff4d6;color:#8c6100}.priority-low{background:#e3fcef;color:#216e4e}
        .task-meta{font-size:12px;color:var(--muted);gap:8px;flex-wrap:wrap}.task-meta i{margin-right:5px}.overdue{color:var(--red)!important;font-weight:700}.task-actions{border-top:1px solid #edf0f3;margin-top:11px;padding-top:8px}.status-form{gap:5px}.status-select{border:0;background:#f2f4f7;border-radius:4px;color:var(--ink);font-size:12px;padding:5px 7px}.icon-button{border:0;background:transparent;color:#6f7f91;padding:5px 7px;border-radius:4px}.icon-button:hover{background:#edf2f7;color:var(--blue)}.delete-button:hover{color:var(--red)}.empty-state{text-align:center;color:#8290a0;padding:34px 10px;font-size:13px}
        .modal-content{border:0;border-radius:7px}.modal-header,.modal-footer{border-color:var(--line)}.form-label{font-size:13px;font-weight:600}.student-note{color:var(--muted);font-size:12px;margin-top:18px}
        @media(max-width:900px){.board{grid-template-columns:1fr}.kanban-column{min-height:180px}.summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:560px){main{padding:16px}.topbar{padding:0 16px}.brand{font-size:15px}.db-state{max-width:130px;text-align:right}.page-heading{align-items:stretch;flex-direction:column}.primary-button{align-self:flex-start}.toolbar{align-items:stretch;flex-direction:column}.search-box{max-width:none}.toolbar select{width:100%}.summary-item{padding:11px}.summary-item span{font-size:12px}.summary-item strong{font-size:19px}}
      </style>
    </head><body>
      ${renderMenu(req.session.user)}
      <main>
        <div class="page-heading"><div class="d-flex align-items-start gap-3">${selectedProject ? '<a class="btn btn-outline-secondary project-back" href="/"><i class="fa-solid fa-arrow-left"></i> Tất cả dự án</a>' : ''}<div><h1>${selectedProject ? escapeHtml(selectedProject.title) : 'Các dự án'}</h1><div class="subtitle">${selectedProject ? escapeHtml(selectedProject.description || 'Bảng công việc của dự án') : 'Chọn một dự án để xem và quản lý công việc.'}</div></div></div>
          <div class="page-actions d-flex flex-wrap gap-2">${selectedProject ? `<a class="btn btn-outline-primary" href="/projects/${selectedProject.id}/export.csv"><i class="fa-solid fa-file-csv"></i> Xuất CSV</a><button class="primary-button" data-bs-toggle="modal" data-bs-target="#taskModal"><i class="fa-solid fa-plus"></i> Thêm công việc</button>${req.session.user.role === 'admin' ? `<form method="POST" action="/api/projects/${selectedProject.id}/delete" onsubmit="return confirm('Xóa dự án này cùng toàn bộ công việc và lịch sử?')"><button class="btn btn-outline-danger" type="submit" ${projects.length <= 1 ? 'disabled title="Không thể xóa dự án cuối cùng"' : ''}><i class="fa-regular fa-trash-can"></i> Xóa dự án</button></form>` : ''}` : ''}${req.session.user.role === 'admin' && !selectedProject ? '<button class="btn btn-outline-secondary" data-bs-toggle="modal" data-bs-target="#projectModal"><i class="fa-solid fa-folder-plus"></i> Thêm dự án</button>' : ''}</div></div>
        ${selectedProject ? '' : `<section class="project-grid" aria-label="Danh sách dự án">${projects.map(renderProject).join('') || `<div class="panel empty-state">${req.session.user.role === 'admin' ? 'Chưa có dự án. Tạo dự án đầu tiên để bắt đầu.' : 'Chưa có dự án nào được tạo.'}</div>`}</section>`}
        ${selectedProject ? `<section class="panel mb-3" aria-label="Tiến độ dự án"><div class="d-flex justify-content-between align-items-center mb-2"><strong>Tiến độ dự án</strong><strong>${completion}%</strong></div><div class="project-progress" role="progressbar" aria-valuenow="${completion}" aria-valuemin="0" aria-valuemax="100"><span style="width:${completion}%"></span></div><div class="muted mt-2">${counts.Done} / ${tasks.length} công việc hoàn thành</div></section>` : ''}
        ${selectedProject ? `<section class="summary" aria-label="Tổng quan công việc">
          <div class="summary-item"><span>Tổng công việc</span><strong>${tasks.length}</strong></div>
          <div class="summary-item"><span>Đang thực hiện</span><strong>${counts['In Progress']}</strong></div>
          <div class="summary-item"><span>Đã hoàn thành</span><strong>${counts.Done}</strong></div>
          <div class="summary-item alert-count"><span>Quá hạn</span><strong>${overdueCount}</strong></div>
        </section>` : ''}
        ${selectedProject ? `<div class="toolbar"><div class="search-box"><i class="fa-solid fa-magnifying-glass"></i><input id="taskSearch" type="search" placeholder="Tìm tên việc, người thực hiện..." aria-label="Tìm công việc"></div>
          <select id="priorityFilter" aria-label="Lọc theo mức ưu tiên"><option value="">Mọi mức ưu tiên</option><option value="High">Ưu tiên cao</option><option value="Medium">Ưu tiên vừa</option><option value="Low">Ưu tiên thấp</option></select></div>
        <div class="board">${renderColumn('To Do', 'CẦN LÀM', 'fa-regular fa-circle', 'todo')}${renderColumn('In Progress', 'ĐANG THỰC HIỆN', 'fa-solid fa-spinner', 'progress')}${renderColumn('Done', 'HOÀN THÀNH', 'fa-regular fa-circle-check', 'done')}</div>
        <div class="section-heading"><h2>Lịch sử hoạt động</h2></div><section class="panel"><ul class="activity-list">${activities.map(renderActivity).join('') || '<li class="muted">Chưa có hoạt động.</li>'}</ul></section>` : ''}
        <div class="muted mt-4">PostgreSQL: ${escapeHtml(dbStatus)} · Hệ thống Quản lý Dự án</div>
      </main>

      <div class="modal fade" id="projectModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><form method="POST" action="/api/projects"><div class="modal-header"><h2 class="modal-title fs-5 fw-bold">Thêm dự án</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button></div><div class="modal-body"><label class="form-label" for="projectTitle">Tên dự án</label><input id="projectTitle" name="title" class="form-control mb-3" maxlength="255" required><label class="form-label" for="projectDescription">Mô tả</label><textarea id="projectDescription" name="description" class="form-control" maxlength="2000" rows="3"></textarea></div><div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Hủy</button><button type="submit" class="btn btn-primary">Tạo dự án</button></div></form></div></div></div>

      ${selectedProject ? `<div class="modal fade" id="taskModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content">
        <form id="taskForm" action="/api/tasks" method="POST"><input type="hidden" name="project_id" value="${selectedProject.id}"><div class="modal-header"><h2 class="modal-title fs-5 fw-bold" id="taskModalTitle">Thêm công việc</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button></div>
          <div class="modal-body"><div class="mb-3"><label class="form-label" for="taskTitle">Tên công việc</label><input id="taskTitle" name="title" class="form-control" maxlength="255" required></div>
            <div class="mb-3"><label class="form-label" for="taskDescription">Mô tả</label><textarea id="taskDescription" name="description" class="form-control" rows="3" maxlength="2000"></textarea></div>
            <div class="mb-3"><label class="form-label" for="taskAssignee">Người thực hiện</label><input id="taskAssignee" name="assignee" class="form-control" maxlength="100" required></div>
            <div class="row g-3"><div class="col-sm-6"><label class="form-label" for="taskStatus">Trạng thái</label><select id="taskStatus" name="status" class="form-select"><option value="To Do">Cần làm</option><option value="In Progress">Đang thực hiện</option><option value="Done">Hoàn thành</option></select></div>
              <div class="col-sm-6"><label class="form-label" for="taskPriority">Ưu tiên</label><select id="taskPriority" name="priority" class="form-select"><option value="Low">Thấp</option><option value="Medium" selected>Vừa</option><option value="High">Cao</option></select></div></div>
            <div class="mt-3"><label class="form-label" for="taskDueDate">Hạn hoàn thành</label><input id="taskDueDate" name="due_date" type="date" class="form-control"></div>
          </div><div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Hủy</button><button type="submit" class="btn btn-primary">Lưu công việc</button></div>
        </form>
      </div></div></div>` : ''}
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
      <script>
        const taskModal = document.getElementById('taskModal');
        if (taskModal) {
        const taskForm = document.getElementById('taskForm');
        document.querySelectorAll('.edit-task').forEach(button => button.addEventListener('click', () => {
          taskForm.action = '/api/tasks/' + button.dataset.id;
          document.getElementById('taskModalTitle').textContent = 'Chỉnh sửa công việc';
          taskForm.elements.project_id.value = button.dataset.projectId;
          for (const field of ['title', 'assignee', 'status', 'priority', 'dueDate', 'description']) {
            taskForm.elements[field === 'dueDate' ? 'due_date' : field].value = button.dataset[field] || '';
          }
          bootstrap.Modal.getOrCreateInstance(taskModal).show();
        }));
        taskModal.addEventListener('hidden.bs.modal', () => {
          taskForm.reset(); taskForm.action = '/api/tasks'; taskForm.elements.project_id.value = '${selectedProjectId || ''}';
          document.getElementById('taskModalTitle').textContent = 'Thêm công việc';
        });
        const applyFilters = () => {
          const query = document.getElementById('taskSearch').value.trim().toLocaleLowerCase('vi');
          const priority = document.getElementById('priorityFilter').value;
          document.querySelectorAll('.task-card').forEach(card => {
            card.hidden = !card.dataset.search.toLocaleLowerCase('vi').includes(query) || (priority && card.dataset.priority !== priority);
          });
        };
        document.getElementById('taskSearch').addEventListener('input', applyFilters);
        document.getElementById('priorityFilter').addEventListener('change', applyFilters);
        }
      </script>
    </body></html>
  `);
});

// 6. Endpoint Prometheus Metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

initDb().then(() => {
  app.listen(port, () => console.log(`Project Management App running on port ${port}`));
}).catch(err => {
  console.error('Database initialization failed; restarting container:', err);
  process.exit(1);
});