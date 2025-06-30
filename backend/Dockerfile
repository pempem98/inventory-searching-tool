# Sử dụng một base image Node.js gọn nhẹ dựa trên Alpine Linux
FROM node:18-alpine

# Đặt thư mục làm việc bên trong container
WORKDIR /usr/src/app

# Cài đặt các gói cần thiết:
# - dcron: Dịch vụ lập lịch (tên đúng trên Alpine)
# - curl: Công cụ để thực hiện các yêu cầu HTTP trong script của chúng ta
RUN apk add --no-cache dcron curl

# Sao chép các tệp quản lý dependency và cài đặt chúng
COPY package*.json ./
RUN npm install

# Sao chép các tệp crontab, script cập nhật và script khởi động
COPY crontab /etc/crontabs/root
COPY update_dns.sh .
COPY entrypoint.sh .

# Cấp quyền thực thi cho các script
RUN chmod +x update_dns.sh
RUN chmod +x entrypoint.sh

# Sao chép phần còn lại của mã nguồn ứng dụng
COPY . .

# Đặt entrypoint của container thành script khởi động của chúng ta
ENTRYPOINT ["./entrypoint.sh"]

