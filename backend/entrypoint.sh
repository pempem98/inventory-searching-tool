#!/bin/sh

# Bắt đầu dịch vụ cron trong nền
crond -f -l 8 &

# Chạy ứng dụng Node.js ở tiền cảnh (làm tiến trình chính)
# Sử dụng `exec` để tiến trình Node thay thế tiến trình shell này
# Điều này đảm bảo các tín hiệu như STOP/KILL được chuyển tiếp đúng cách
echo "Starting Node.js server..."
exec node src/index.js
