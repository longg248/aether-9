import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'AETHER-9: Hành Tinh Khai Khoáng',
  description:
    'Game chiến lược khai khoáng & sinh tồn 2D: điều khiển Rover, xây căn cứ tự động, chống Bọ Tinh Thể và nạp đủ Aether để kích hoạt Động cơ Bước Nhảy.',
};

export const viewport: Viewport = {
  themeColor: '#020617',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
