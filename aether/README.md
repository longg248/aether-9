# AETHER-9: Hành Tinh Khai Khoáng

Game chiến lược khai khoáng & sinh tồn 2D chạy ngay trên trình duyệt, viết bằng **Next.js (App Router) + TypeScript + Tailwind CSS**, vẽ bằng **Canvas 2D**.

Bạn điều khiển Rover Kỹ Sư, dựng chuỗi khai khoáng tự động, phòng thủ trước Bọ Tinh Thể và nạp đủ **1.200 Aether** vào Động cơ Bước Nhảy để thoát khỏi hành tinh.

## Chạy thử

Yêu cầu Node.js **22.12 trở lên**.

```bash
cd aether
npm install
npm run dev      # http://localhost:3000
```

Các lệnh khác:

| Lệnh                | Tác dụng                          |
| ------------------- | --------------------------------- |
| `npm run build`     | Build production                  |
| `npm run start`     | Chạy bản build                    |
| `npm run lint`      | Kiểm tra ESLint                   |
| `npm run typecheck` | Kiểm tra kiểu TypeScript          |
| `npm test`          | Chạy test logic game (Vitest)     |

## Điều khiển

| Phím / chuột        | Tác dụng                                         |
| ------------------- | ------------------------------------------------ |
| `W A S D` / mũi tên | Di chuyển Rover                                  |
| Click chuột         | Di chuyển, khai thác mỏ, mở Hộp Tiếp Tế         |
| `1` – `8`           | Chọn công trình để xây (click để đặt)            |
| `Space`             | Lướt Ion                                         |
| `Q`                 | Xung EMP                                         |
| `E`                 | Quá Tải Laser                                    |
| `R`                 | Sửa chữa nhanh toàn căn cứ                       |
| `T`                 | Mở / đóng Cây Công Nghệ                          |
| `Esc`               | Hủy chế độ xây, đóng cây công nghệ               |

## Cấu trúc thư mục

```
aether/
├── app/                       # Next.js App Router (layout, trang chủ, CSS)
└── scr/                       # Mã nguồn game, import qua alias "@/"
    ├── components/game/       # Giao diện React + HUD (AetherGame.tsx)
    ├── constants/             # Cấu hình công trình, nâng cấp, giai đoạn
    ├── engine/                # Vòng lặp & logic game (gameEngine.ts)
    ├── types/                 # Kiểu dữ liệu dùng chung
    └── utils/                 # Sinh địa hình, âm thanh
```
