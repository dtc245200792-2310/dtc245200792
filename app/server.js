const express = require('express');
const client = require('prom-client');
const app = express();

// Khởi tạo Prometheus Register để thu thập metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Route chính của ứng dụng Quản lý Dự án
app.get('/', (req, res) => {
  res.send(`
    <h1>Hệ thống Quản lý Dự án (Project Management) - Đề 14</h1>
    <p>Mã số SV: dtc245200792</p>
    <p>Trạng thái: Ứng dụng đang hoạt động ổn định!</p>
  `);
});

// Endpoint trả về metrics cho Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(3000, () => {
  console.log('App running on port 3000');
});