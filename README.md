# TI-NASONXIMANG-V3

Ung dung desktop theo ha tang Deplao, toi uu cho quy trinh khach hang nhap don hang.

## Cong nghe va ha tang da ap dung

- Electron (desktop app)
- React + TypeScript + Vite (renderer UI)
- Node.js + Express (backend service chay noi bo)
- SQLite qua better-sqlite3 (luu don hang offline)
- WebSocket (dong bo realtime danh sach don)
- Zustand (quan ly state phia UI)
- Tailwind CSS + PostCSS (giao dien)
- electron-builder (dong goi EXE)
- GitHub Actions (build va publish GitHub Release)

## Chuc nang hien tai

- Khach hang nhap don hang: ten, so dien thoai, san pham, so luong, ghi chu.
- Don hang duoc luu vao SQLite noi bo.
- Danh sach don cap nhat realtime thong qua WebSocket.

## Chay local

```bash
npm install
npm run dev
```

## Build EXE local

```bash
npm run production
```

File EXE tao ra trong thu muc `dist-electron-build/`.

## Phat hanh EXE len GitHub Release

1. Day code len nhanh `main`.
2. Tao tag va push:

```bash
git tag v1.0.0
git push origin v1.0.0
```

3. Workflow [`.github/workflows/build-windows.yml`](.github/workflows/build-windows.yml) se tu dong:
- Build app tren `windows-latest`
- Dong goi `*.exe`
- Dang artifact len GitHub Release

Ban cung co the chay tay workflow trong tab Actions voi `publish=true`.
