# Đề tài 14: Hệ thống Quản lý Dự án (Project Management)
**Môn học:** Triển khai và Quản trị Hệ thống Phần mềm  
**Mã số SV:** dtc245200792  

## 1. Giới thiệu Kiến trúc Hệ thống
Hệ thống được thiết kế và triển khai hoàn toàn bằng Docker Compose, bao gồm các thành phần:
- **Web Application**: Node.js / Express (Port internal 3000)
- **Database & Management**: PostgreSQL 15 & pgAdmin 4
- **Reverse Proxy**: Nginx (Cấu hình SSL HTTPS tự ký + Security Headers)
- **Monitoring (Giám sát)**: Prometheus + Grafana + cAdvisor
- **Logging (Log tập trung)**: Loki + Promtail (Truy vấn LogQL)

## 2. Các biện pháp Bảo mật (Hardening)
- **Non-root Container**: Web App được đóng gói và chạy dưới quyền user thường (`appuser`).
- **Network Isolation**: Phân tách thành 3 mạng riêng biệt (`frontend-net`, `backend-net`, `monitoring-net`).
- **Strong Authentication**: Mật khẩu quản trị cơ sở dữ liệu và pgAdmin đạt độ phức tạp cao.
- **Nginx Security Headers**: Tích hợp các header HSTS, X-Frame-Options, XSS Protection, X-Content-Type-Options.

## 3. Hướng dẫn Khởi chạy Hệ thống
### Yêu cầu tiên quyết:
- Đã cài đặt Docker và Docker Compose trên máy.

### Các bước thực hiện:
1. Clone Repository từ GitHub:
  git clone https://github.com/dtc245200792-2310/dtc245200792.git
cd dtc245200792

## 4. Tính năng ứng dụng
- Quản lý nhiều dự án; mỗi dự án có bảng công việc và tiến độ tính theo tỷ lệ công việc hoàn thành.
- Đăng nhập theo phiên; admin tạo tài khoản và dự án, thành viên cập nhật công việc.
- Nhật ký hoạt động theo dự án và xuất danh sách công việc CSV.
- Dữ liệu bảng công việc cũ được chuyển sang dự án mặc định khi app khởi động lần đầu sau nâng cấp.

## 5. Tài khoản và khởi động
- Tài khoản khởi tạo mặc định: `admin` / `ChangeMe123!`.
- Trước khi dùng chung, đặt `ADMIN_USERNAME`, `ADMIN_PASSWORD` và `SESSION_SECRET` trong môi trường chạy Docker Compose. Mật khẩu quản trị tối thiểu 10 ký tự.
- Chạy `docker-compose up -d --build app` để cập nhật ứng dụng. Nếu Nginx còn giữ địa chỉ container cũ, chạy `docker-compose restart nginx`.
- Đăng nhập tại `http://localhost`; Prometheus tiếp tục lấy metrics từ endpoint `/metrics`.