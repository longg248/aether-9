import { BuildingConfig, BuildingType, PhaseInfo, UpgradeConfig } from '@/types/game';

export const GRID_SIZE = 44;
export const TILE_SIZE = 48;
export const WORLD_SIZE = GRID_SIZE * TILE_SIZE;
export const HUB_GX = 22;
export const HUB_GY = 22;
export const HUB_X = (HUB_GX + 0.5) * TILE_SIZE;
export const HUB_Y = (HUB_GY + 0.5) * TILE_SIZE;
export const TARGET_WARP_AETHER = 1200;

export const BUILDINGS: Record<BuildingType, BuildingConfig> = {
  solar: {
    id: 'solar',
    key: '1',
    name: 'Pin Mặt Trời',
    cost: { silicate: 25 },
    energyDelta: 12,
    maxHp: 140,
    color: '#0284c7',
    accent: '#38bdf8',
    desc: '+12 MW năng lượng (giảm 40% hiệu suất vào ban đêm).',
  },
  drill: {
    id: 'drill',
    key: '2',
    name: 'Máy Khoan Tự Động',
    cost: { silicate: 35, iron: 15 },
    energyDelta: -8,
    maxHp: 180,
    color: '#d97706',
    accent: '#fbbf24',
    desc: 'Đặt trực tiếp lên mỏ quặng. Triệu hồi Drone tự động vận chuyển.',
  },
  smelter: {
    id: 'smelter',
    key: '3',
    name: 'Lò Luyện Kim',
    cost: { silicate: 50, iron: 30 },
    energyDelta: -14,
    maxHp: 220,
    color: '#dc2626',
    accent: '#f87171',
    desc: 'Tinh luyện Silicat thành Sắt và tổng hợp Tinh thể Aether.',
  },
  radar: {
    id: 'radar',
    key: '4',
    name: 'Trạm Radar Quét',
    cost: { silicate: 45, iron: 25 },
    energyDelta: -10,
    maxHp: 160,
    color: '#059669',
    accent: '#34d399',
    radius: 7.5,
    desc: 'Mở rộng tầm nhìn sương mù & phát hiện Hộp Tiếp Tế rơi.',
  },
  turret: {
    id: 'turret',
    key: '5',
    name: 'Tháp Pháo Laser',
    cost: { silicate: 40, iron: 35 },
    energyDelta: -10,
    maxHp: 240,
    color: '#e11d48',
    accent: '#fb7185',
    radius: 5.5,
    desc: 'Tự động bắn tia laser phòng thủ trước Bọ Tinh Thể.',
  },
  wall: {
    id: 'wall',
    key: '6',
    name: 'Tường Chắn Hợp Kim',
    cost: { silicate: 15, iron: 10 },
    energyDelta: 0,
    maxHp: 480,
    color: '#475569',
    accent: '#94a3b8',
    desc: 'Tự động liên kết giáp, chặn bước tiến của quái vật.',
  },
  lab: {
    id: 'lab',
    key: '7',
    name: 'Phòng Nghiên Cứu Aether',
    cost: { silicate: 90, iron: 70, aether: 25 },
    energyDelta: -20,
    maxHp: 260,
    color: '#7c3aed',
    accent: '#c084fc',
    desc: 'Mở khóa công nghệ cấp cao & tổng hợp +1.5 Aether/giây.',
  },
  repair_bay: {
    id: 'repair_bay',
    key: '8',
    name: 'Trạm Sửa Chữa & Khiên',
    cost: { silicate: 70, iron: 55, aether: 15 },
    energyDelta: -16,
    maxHp: 240,
    color: '#0d9488',
    accent: '#2dd4bf',
    radius: 5.0,
    desc: 'Tự động phóng tia nano sửa chữa & giảm 25% sát thương vùng.',
  },
};

export const BUILDING_LIST: BuildingConfig[] = Object.values(BUILDINGS);

export const UPGRADES: UpgradeConfig[] = [
  {
    id: 'rover_laser',
    name: 'Tia Khoan & Động Cơ Rover',
    cost: { silicate: 60, iron: 40 },
    maxLevel: 5,
    desc: '+35% tốc độ khai thác, +15% tốc độ di chuyển Rover.',
  },
  {
    id: 'drone_logistics',
    name: 'AI Hậu Cần & Drone',
    cost: { iron: 70, aether: 20 },
    maxLevel: 5,
    desc: '+30% tốc độ bay và sức chứa khoang của Drone.',
  },
  {
    id: 'turret_optics',
    name: 'Thấu Kính Laser & Tháp Pháo',
    cost: { iron: 85, aether: 35 },
    maxLevel: 5,
    desc: '+35% sát thương Tháp Pháo Laser & kỹ năng Rover.',
  },
  {
    id: 'shield_matrix',
    name: 'Ma Trận Giáp & Chống Bão',
    cost: { silicate: 100, iron: 80, aether: 45 },
    maxLevel: 4,
    reqLab: true,
    desc: '+400 giáp tối đa Trung tâm & giảm 35% sát thương Bão Từ.',
  },
  {
    id: 'aether_capacitor',
    name: 'Tụ Điện Lượng Tử Warp',
    cost: { iron: 130, aether: 90 },
    maxLevel: 4,
    reqLab: true,
    desc: 'Tăng 45% tốc độ nạp Aether vào Động cơ Bước Nhảy.',
  },
];

export const PHASES: PhaseInfo[] = [
  {
    id: 0,
    title: 'GIAI ĐOẠN 1: ĐỔ BỘ & KHAI PHÁ',
    aiDirective:
      'Valkyrie-7: Dùng WASD hoặc Click chuột điều khiển Rover khai thác mỏ quanh căn cứ. Xây Pin Mặt Trời [1] và Máy Khoan [2].',
    targetAether: 80,
  },
  {
    id: 1,
    title: 'GIAI ĐOẠN 2: MẠNG LƯỚI TỰ ĐỘNG',
    aiDirective:
      'Valkyrie-7: Thiết lập Lò Luyện Kim [3] và Trạm Radar [4] để mở rộng bản đồ và thu hồi Hộp Tiếp Tế rơi trên bề mặt.',
    targetAether: 280,
  },
  {
    id: 2,
    title: 'GIAI ĐOẠN 3: PHÒNG TUYẾN & BÃO TỪ',
    aiDirective:
      'Valkyrie-7: Bức xạ địa từ tăng cao! Xây Tường Chắn [6], Tháp Pháo [5] và Phòng Nghiên Cứu [7] trước các đợt tấn công.',
    targetAether: 600,
  },
  {
    id: 3,
    title: 'GIAI ĐOẠN 4: CHIẾN DỊCH BEHEMOTH',
    aiDirective:
      'Valkyrie-7: Cảnh báo sinh vật khổng lồ Aether Behemoth! Kích hoạt Trạm Sửa Chữa [8] và dùng kỹ năng [Q] EMP để khống chế.',
    targetAether: 950,
  },
  {
    id: 4,
    title: 'GIAI ĐOẠN 5: KHỞI ĐỘNG BƯỚC NHẢY WARP',
    aiDirective:
      'Valkyrie-7: Lõi Động cơ Bước Nhảy đã đạt ngưỡng tới hạn! Bảo vệ Trung tâm Chỉ huy cho tới khi đạt 100% Aether.',
    targetAether: TARGET_WARP_AETHER,
  },
];