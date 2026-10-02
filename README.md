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