const express = require('express');
const client = require('prom-client');
const { Pool } = require('pg');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

const initDb = async () => {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          assignee VARCHAR(100) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'To Do',
          description TEXT NOT NULL DEFAULT '',
          priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
          due_date DATE,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'Medium';
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS due_date DATE;
      `);

      const result = await pool.query('SELECT COUNT(*) FROM projects');
      if (Number(result.rows[0].count) === 0) {
        await pool.query(`
          INSERT INTO projects (title, assignee, status, priority) VALUES
          ('Thiết kế giao diện Dashboard', 'Đỗ Bình An', 'In Progress', 'High'),
          ('Cấu hình Nginx & SSL Security', 'Nguyễn Văn A', 'Done', 'Medium'),
          ('Tích hợp Prometheus & Grafana', 'Đỗ Bình An', 'To Do', 'Low');
        `);
      }
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

app.post('/api/tasks', async (req, res) => {
  const { title, assignee, status = 'To Do', priority = 'Medium', description = '', due_date = '' } = req.body;
  if (!validTask({ title, assignee, status, priority })) {
    return res.status(400).send('Vui lòng nhập tên công việc, người thực hiện và giá trị hợp lệ.');
  }
  try {
    await pool.query(
      'INSERT INTO projects (title, assignee, status, priority, description, due_date) VALUES ($1, $2, $3, $4, $5, $6)',
      [title.trim(), assignee.trim(), status, priority, String(description).trim(), due_date || null]
    );
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Lỗi khi thêm công việc: ' + escapeHtml(err.message));
  }
});

app.post('/api/tasks/:id', async (req, res) => {
  const { title, assignee, status, priority, description = '', due_date = '' } = req.body;
  if (!/^\d+$/.test(req.params.id) || !validTask({ title, assignee, status, priority })) {
    return res.status(400).send('Thông tin công việc không hợp lệ.');
  }
  try {
    const result = await pool.query(
      'UPDATE projects SET title = $1, assignee = $2, status = $3, priority = $4, description = $5, due_date = $6 WHERE id = $7',
      [title.trim(), assignee.trim(), status, priority, String(description).trim(), due_date || null, req.params.id]
    );
    if (!result.rowCount) return res.status(404).send('Không tìm thấy công việc.');
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Lỗi khi cập nhật công việc: ' + escapeHtml(err.message));
  }
});

app.post('/api/tasks/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!/^\d+$/.test(req.params.id) || !taskStatuses.includes(status)) {
    return res.status(400).send('Trạng thái công việc không hợp lệ.');
  }
  try {
    await pool.query('UPDATE projects SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Lỗi khi cập nhật trạng thái: ' + escapeHtml(err.message));
  }
});

app.post('/api/tasks/delete/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).send('Mã công việc không hợp lệ.');
  try {
    await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Lỗi khi xóa công việc: ' + escapeHtml(err.message));
  }
});

app.get('/', async (req, res) => {
  let tasks = [];
  let dbStatus = 'Connected';
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY due_date NULLS LAST, created_at DESC');
    tasks = result.rows;
  } catch (err) {
    dbStatus = 'Error: ' + err.message;
  }

  const counts = Object.fromEntries(taskStatuses.map(status => [status, tasks.filter(task => task.status === status).length]));
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = tasks.filter(task => task.due_date && task.due_date.toISOString().slice(0, 10) < today && task.status !== 'Done').length;
  const renderTask = task => {
    const dueDate = task.due_date ? task.due_date.toISOString().slice(0, 10) : '';
    const dueLabel = dueDate ? new Date(`${dueDate}T00:00:00`).toLocaleDateString('vi-VN') : 'Chưa đặt hạn';
    const priorityClass = { High: 'priority-high', Medium: 'priority-medium', Low: 'priority-low' }[task.priority] || 'priority-medium';
    return `
      <article class="task-card" data-search="${escapeHtml(`${task.title} ${task.assignee} ${task.description}`.toLowerCase())}" data-priority="${escapeHtml(task.priority)}">
        <div class="task-topline"><span class="priority ${priorityClass}">${escapeHtml(task.priority === 'High' ? 'Ưu tiên cao' : task.priority === 'Low' ? 'Ưu tiên thấp' : 'Ưu tiên vừa')}</span>
          <button class="icon-button edit-task" type="button" title="Sửa công việc" aria-label="Sửa công việc"
            data-id="${task.id}" data-title="${escapeHtml(task.title)}" data-assignee="${escapeHtml(task.assignee)}"
            data-status="${escapeHtml(task.status)}" data-priority="${escapeHtml(task.priority)}" data-due-date="${dueDate}"
            data-description="${escapeHtml(task.description)}"><i class="fa-solid fa-pen"></i></button>
        </div>
        <h3>${escapeHtml(task.title)}</h3>
        ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
        <div class="task-meta"><span><i class="fa-regular fa-user"></i>${escapeHtml(task.assignee)}</span>
          <span class="${dueDate && dueDate < today && task.status !== 'Done' ? 'overdue' : ''}"><i class="fa-regular fa-calendar"></i>${dueLabel}</span></div>
        <div class="task-actions">
          <form action="/api/tasks/${task.id}/status" method="POST" class="status-form">
            <label class="visually-hidden" for="status-${task.id}">Trạng thái</label>
            <select id="status-${task.id}" name="status" class="status-select" aria-label="Trạng thái công việc">
              ${taskStatuses.map(status => `<option value="${status}" ${task.status === status ? 'selected' : ''}>${status === 'To Do' ? 'Cần làm' : status === 'In Progress' ? 'Đang làm' : 'Hoàn thành'}</option>`).join('')}
            </select><button class="icon-button" type="submit" title="Cập nhật trạng thái" aria-label="Cập nhật trạng thái"><i class="fa-solid fa-arrow-right"></i></button>
          </form>
          <form action="/api/tasks/delete/${task.id}" method="POST" onsubmit="return confirm('Xóa công việc này?')">
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

  res.send(`
    <!doctype html><html lang="vi"><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Quản lý dự án | Đề 14</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <style>
        :root{--ink:#172b4d;--muted:#65758b;--line:#dce3eb;--paper:#fff;--canvas:#f4f6f8;--blue:#1769aa;--green:#16845b;--amber:#a76608;--red:#b42332}
        *{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font-family:"Segoe UI",Tahoma,sans-serif}
        .topbar{height:62px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 24px}
        .brand{font-size:18px;font-weight:700}.brand i{color:var(--blue);margin-right:10px}.db-state{font-size:12px;color:${dbStatus === 'Connected' ? 'var(--green)' : 'var(--red)'}}
        main{max-width:1500px;margin:0 auto;padding:24px}.page-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px}
        h1{font-size:26px;margin:0 0 5px;font-weight:700}.subtitle{color:var(--muted);font-size:14px}.primary-button{background:var(--blue);border:0;border-radius:5px;color:white;padding:10px 15px;font-weight:600}
        .summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:20px}.summary-item{background:#fff;border:1px solid var(--line);border-radius:6px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center}
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
      <header class="topbar"><div class="brand"><i class="fa-solid fa-list-check"></i>Quản lý dự án</div><div class="db-state"><i class="fa-solid fa-database"></i> PostgreSQL: ${escapeHtml(dbStatus)}</div></header>
      <main>
        <div class="page-heading"><div><h1>Bảng công việc</h1><div class="subtitle">Đỗ Bình An · dtc245200792 · Triển khai &amp; Quản trị HT Phần mềm</div></div>
          <button class="primary-button" data-bs-toggle="modal" data-bs-target="#taskModal"><i class="fa-solid fa-plus"></i> Thêm dự án</button></div>
        <section class="summary" aria-label="Tổng quan công việc">
          <div class="summary-item"><span>Tổng công việc</span><strong>${tasks.length}</strong></div>
          <div class="summary-item"><span>Đang thực hiện</span><strong>${counts['In Progress']}</strong></div>
          <div class="summary-item"><span>Đã hoàn thành</span><strong>${counts.Done}</strong></div>
          <div class="summary-item alert-count"><span>Quá hạn</span><strong>${overdueCount}</strong></div>
        </section>
        <div class="toolbar"><div class="search-box"><i class="fa-solid fa-magnifying-glass"></i><input id="taskSearch" type="search" placeholder="Tìm tên việc, người thực hiện..." aria-label="Tìm công việc"></div>
          <select id="priorityFilter" aria-label="Lọc theo mức ưu tiên"><option value="">Mọi mức ưu tiên</option><option value="High">Ưu tiên cao</option><option value="Medium">Ưu tiên vừa</option><option value="Low">Ưu tiên thấp</option></select></div>
        <div class="board">${renderColumn('To Do', 'CẦN LÀM', 'fa-regular fa-circle', 'todo')}${renderColumn('In Progress', 'ĐANG THỰC HIỆN', 'fa-solid fa-spinner', 'progress')}${renderColumn('Done', 'HOÀN THÀNH', 'fa-regular fa-circle-check', 'done')}</div>
        <div class="student-note">Hệ thống Quản lý Dự án - Đề 14</div>
      </main>

      <div class="modal fade" id="taskModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content">
        <form id="taskForm" action="/api/tasks" method="POST"><div class="modal-header"><h2 class="modal-title fs-5 fw-bold" id="taskModalTitle">Thêm công việc</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button></div>
          <div class="modal-body"><div class="mb-3"><label class="form-label" for="taskTitle">Tên công việc</label><input id="taskTitle" name="title" class="form-control" maxlength="255" required></div>
            <div class="mb-3"><label class="form-label" for="taskDescription">Mô tả</label><textarea id="taskDescription" name="description" class="form-control" rows="3" maxlength="2000"></textarea></div>
            <div class="mb-3"><label class="form-label" for="taskAssignee">Người thực hiện</label><input id="taskAssignee" name="assignee" class="form-control" maxlength="100" required></div>
            <div class="row g-3"><div class="col-sm-6"><label class="form-label" for="taskStatus">Trạng thái</label><select id="taskStatus" name="status" class="form-select"><option value="To Do">Cần làm</option><option value="In Progress">Đang thực hiện</option><option value="Done">Hoàn thành</option></select></div>
              <div class="col-sm-6"><label class="form-label" for="taskPriority">Ưu tiên</label><select id="taskPriority" name="priority" class="form-select"><option value="Low">Thấp</option><option value="Medium" selected>Vừa</option><option value="High">Cao</option></select></div></div>
            <div class="mt-3"><label class="form-label" for="taskDueDate">Hạn hoàn thành</label><input id="taskDueDate" name="due_date" type="date" class="form-control"></div>
          </div><div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Hủy</button><button type="submit" class="btn btn-primary">Lưu công việc</button></div>
        </form>
      </div></div></div>
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
      <script>
        const taskModal = document.getElementById('taskModal');
        const taskForm = document.getElementById('taskForm');
        document.querySelectorAll('.edit-task').forEach(button => button.addEventListener('click', () => {
          taskForm.action = '/api/tasks/' + button.dataset.id;
          document.getElementById('taskModalTitle').textContent = 'Chỉnh sửa công việc';
          for (const field of ['title', 'assignee', 'status', 'priority', 'dueDate', 'description']) {
            taskForm.elements[field === 'dueDate' ? 'due_date' : field].value = button.dataset[field] || '';
          }
          bootstrap.Modal.getOrCreateInstance(taskModal).show();
        }));
        taskModal.addEventListener('hidden.bs.modal', () => {
          taskForm.reset(); taskForm.action = '/api/tasks';
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