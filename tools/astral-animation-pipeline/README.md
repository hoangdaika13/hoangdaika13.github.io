# Astral Realms Animation Pipeline V13

Pipeline này bake animation offline vào đúng rig `HH_VALID_HUMANOID_V1`.
Runtime web không retarget Mixamo và không công bố clip chưa tồn tại.

## Công cụ

- Blender portable mặc định: `C:\Users\Admin\Documents\HTML\.tools\blender-5.2.0\blender-5.2.0-windows-x64\blender.exe`
- glTF Transform CLI 4.4.2: `%APPDATA%\npm\gltf-transform.cmd`
- GPU phát hiện khi cài: NVIDIA GeForce RTX 3060 12 GB

## Tạo thư viện hiện có

```powershell
powershell -ExecutionPolicy Bypass -File tools\astral-animation-pipeline\install-free-motion-pack.ps1
powershell -ExecutionPolicy Bypass -File tools\astral-animation-pipeline\build-motion-library.ps1
```

Installer tải gói Quaternius Universal Animation Library Standard từ bản phát
hành chính thức, kiểm tra SHA-256 rồi giữ source trong `.tools`. Baker kết hợp ba
clip Vanguard với các clip CC0 tương thích và hiện xuất 24 clip thật. Manifest
vẫn trả `partial` cho tới khi mọi clip trong motion plan được cung cấp; danh sách
thiếu không được tự động điền bằng dữ liệu giả.

Nguồn, giấy phép và hash được lưu trong `THIRD_PARTY_NOTICES.md` và trong
`motion-library-v13.json`.

## Thêm animation FBX hợp lệ

1. Tải animation bằng tài khoản và điều khoản sử dụng hợp lệ.
2. Đặt FBX vào thư mục riêng, không commit file khi giấy phép không cho phép.
3. Gọi build với nhiều source:

```powershell
$sources = @(
  "downloads\astral-motion\Idle_Alert.fbx",
  "downloads\astral-motion\Turn_Left_90.fbx",
  "downloads\astral-motion\Dodge_Forward.fbx"
)
powershell -ExecutionPolicy Bypass -File tools\astral-animation-pipeline\build-motion-library.ps1 -Source $sources
```

Tên Action phải khớp `id` hoặc một alias trong `motion-plan.json`. Clip không
khớp bị bỏ qua thay vì xuất dữ liệu giả. Baker chuyển rotation theo rest-space,
xóa root translation khỏi clip in-place và tạo Blender Action riêng cho mỗi clip. Nhún hông,
độ cao nhảy, chuyển trọng lượng và foot planting được runtime/IK điều khiển theo collider gameplay.

## Output

- `assets/astral-realms/animations/hh-human-motion-v13.glb`
- `assets/astral-realms/animations/motion-library-v13.json`

Sau Blender, keyframe được `resample` rồi nén Meshopt. Không nén texture vì đây
là thư viện animation-only.
