const express = require('express');
const client = require('prom-client');
const { Pool } = require('pg');

const app = express();
const port = 3000;

// 1. Khởi tạo Prometheus Register để thu thập Metrics cho Tiêu chí 4
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// 2. Khởi tạo kết nối CSDL PostgreSQL cho Tiêu chí 2
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  user: process.env.POSTGRES_USER || 'app_user',
  password: process.env.POSTGRES_PASSWORD || 'SecurePassword123!',
  database: process.env.POSTGRES_DB || 'project_db',
  port: 5432,
});

// 3. Giao diện trang chủ Web Quản lý Dự án
app.get('/', async (req, res) => {
  let dbStatus = '';
  try {
    const result = await pool.query('SELECT NOW()');
    dbStatus = `<span style="color: green; font-weight: bold;">Kết nối thành công! (Thời gian CSDL: ${result.rows[0].now})</span>`;
  } catch (err) {
    dbStatus = `<span style="color: red; font-weight: bold;">Lỗi kết nối CSDL: ${err.message}</span>`;
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Hệ thống Quản lý Dự án</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background-color: #f4f6f9; }
            .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            h1 { color: #0056b3; }
            .info { margin-top: 20px; padding: 15px; background: #e9ecef; border-radius: 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Hệ thống Quản lý Dự án (Project Management) - Đề 14</h1>
            <p><strong>Sinh viên thực hiện:</strong> Đỗ Bình An</p>
            <p><strong>Mã số SV:</strong> dtc245200792</p>
            
            <div class="info">
                <h3>Trạng thái hệ thống:</h3>
                <p><strong>Trạng thái Web App:</strong> Đang hoạt động ổn định trên cổng 3000</p>
                <p><strong>Trạng thái PostgreSQL:</strong> ${dbStatus}</p>
            </div>
        </div>
    </body>
    </html>
  `);
});

// 4. Endpoint xuất chỉ số giám sát cho Prometheus (/metrics)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(port, () => {
  console.log(`App running on port ${port}`);
});