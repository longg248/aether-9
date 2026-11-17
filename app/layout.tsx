import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AETHER-9: Hành Tinh Khai Khoáng',
  description:
    'Điều khiển Rover Kỹ Sư, xây dựng chuỗi khai khoáng tự động, phòng thủ trước Bọ Tinh Thể và nạp đủ Aether để kích hoạt Động cơ Bước Nhảy.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}