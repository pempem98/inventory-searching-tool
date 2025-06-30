#!/bin/sh

# Thêm dòng này để script biết nó đang chạy ở đâu, hữu ích cho việc debug
echo "--- Chạy Cron Job cập nhật DNS lúc $(date) ---"

# =================================================================
# BƯỚC 1: KHAI BÁO CÁC BIẾN CẤU HÌNH
# =================================================================
CLOUDFLARE_API_TOKEN="<unknow>"
ZONE_ID="<unknown>"
DNS_RECORD_ID="<unknown>"
RECORD_NAME="<unknown>"

# =================================================================
# BƯỚC 2: TỰ ĐỘNG LẤY ĐỊA CHỈ IPV4 PUBLIC (Tương thích với /bin/sh)
# =================================================================

# Danh sách các dịch vụ cung cấp IP, được ngăn cách bởi dấu cách
IP_PROVIDERS="https://api.ipify.org https://icanhazip.com https://ipinfo.io/ip https://checkip.amazonaws.com"
PUBLIC_IP=""

# Vòng lặp for tiêu chuẩn, hoạt động trên mọi shell
for provider in $IP_PROVIDERS; do
  IP=$(curl --ipv4 -s --connect-timeout 5 "$provider")

  # Kiểm tra xem kết quả có phải là địa chỉ IPv4 hợp lệ không
  # Sử dụng `case` thay cho `[[ ... =~ ... ]]` để tương thích với sh
  case "$IP" in
    *[!0-9.]*)
      # Chứa ký tự không phải số hoặc dấu chấm -> không hợp lệ
      :
      ;;
    *.*.*.*)
      # Có 3 dấu chấm -> có thể hợp lệ, gán và thoát
      PUBLIC_IP=$IP
      break
      ;;
    *)
      # Các trường hợp khác -> không hợp lệ
      :
      ;;
  esac
done

if [ -z "$PUBLIC_IP" ]; then
  echo "LỖI: Không thể lấy được địa chỉ IP public."
  exit 1
fi

# =================================================================
# BƯỚC 3: TẠO DỮ LIỆU JSON VÀ THỰC THI LỆNH cURL
# =================================================================
JSON_PAYLOAD=$(cat <<EOM
{
  "type": "A",
  "name": "$RECORD_NAME",
  "content": "$PUBLIC_IP",
  "ttl": 1,
  "proxied": true
}
EOM
)

curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$DNS_RECORD_ID" \
  -X PUT \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -d "$JSON_PAYLOAD"

