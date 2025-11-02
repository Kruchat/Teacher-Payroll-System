# {{APP_NAME}}

เว็บแอปบันทึกเอกสารส่วนตัวด้วย Google Apps Script + Google Sheets + Google Drive รองรับการอัปโหลดไฟล์, จัดเก็บเมตาดาต้า, ค้นหา/กรอง, ทริกเกอร์แจ้งเตือนวันหมดอายุ และสำรองข้อมูลอัตโนมัติ

## โครงสร้างไฟล์

| ไฟล์ | คำอธิบาย |
| --- | --- |
| `Code.gs` | จุดเริ่มต้นเว็บแอป (doGet/doPost), เราท์ API, รวม util |
| `Api.gs` | ฟังก์ชัน CRUD, อัปโหลดไฟล์, เตือนหมดอายุ, สำรองข้อมูล, Export |
| `Triggers.gs` | สร้าง/ลบทริกเกอร์ประจำวันและรายสัปดาห์ |
| `index.html` | ส่วนติดต่อผู้ใช้ (Tailwind + Alpine.js) รองรับ Mobile-first, Dark mode |
| `README.md` | คู่มือการติดตั้งใช้งาน |

## ตัวแปรโครงการ (ตั้งค่าก่อนใช้งานจริง)

| ตัวแปร | ค่า |
| --- | --- |
| `{{APP_NAME}}` | ชื่อเว็บแอป (แสดงบน UI และอีเมล) |
| `{{SHEET_ID}}` | ไอดี Google Sheet ที่เก็บเมตาดาต้า |
| `{{SHEET_NAME}}` | ชื่อแท็บในชีต (ค่าแนะนำ: `documents`) |
| `{{DRIVE_FOLDER_ID}}` | ไอดีโฟลเดอร์ Drive สำหรับเก็บไฟล์ที่อัปโหลด |
| `{{ADMIN_PASS}}` | รหัสผ่านโหมดผู้ดูแล (ตั้งค่าใน Script Properties) |

> **หมายเหตุ:** สามารถใช้ปุ่ม **"สร้างชีต & โฟลเดอร์"** ในหน้า Settings ของเว็บแอปเพื่อให้สคริปต์สร้าง Spreadsheet + Drive Folder พร้อมตั้งค่า Script Properties ให้อัตโนมัติได้ทันที

## สคีมาชีต

คอลัมน์ตามลำดับ: `id, title, category, tags, owner, issueDate, expiryDate, remindDays, driveFileId, driveFileUrl, version, location, source, status, notes, createdAt, updatedAt`

- `id` เป็น UUID (สร้างอัตโนมัติ)
- `status` เป็น `active`, `archived`, หรือ `expired`
- `remindDays` ≥ 0
- บันทึก `createdAt` / `updatedAt` ทุกครั้ง
- คอลัมน์ `driveFileId` และ `driveFileUrl` เก็บข้อมูลไฟล์ (ถ้ามีหลายไฟล์จะคั่นด้วย `|`)
- คอลัมน์ `version` เก็บ JSON string แสดงประวัติเวอร์ชันไฟล์

## ข้อมูลตัวอย่าง (Seed)

เพิ่มข้อมูล 3–5 แถวสำหรับทดสอบ (แทนค่าด้วยไอดีจริงเมื่อใช้งาน):

> เมื่อใช้ปุ่ม **"สร้างชีต & โฟลเดอร์"** ระบบจะเติมข้อมูลตัวอย่างในตารางให้อัตโนมัติ สามารถลบหรือแก้ไขได้ภายหลัง

| id | title | category | tags | owner | issueDate | expiryDate | remindDays | driveFileId | driveFileUrl | version | location | source | status | notes | createdAt | updatedAt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `UUID-1` | บัตรประชาชน | ส่วนตัว | `id,important` | me@email.com | 2020-01-01 | 2030-01-01 | 30 | FILE_ID_1 | https://drive.google.com/open?id=FILE_ID_1 | `[{"version":"v1","fileId":"FILE_ID_1","fileUrl":"https://drive.google.com/open?id=FILE_ID_1","fileName":"idcard.pdf","uploadedAt":"2024-01-01T00:00:00Z"}]` | ลิ้นชัก | สแกน | active | สำเนาบัตร | 2024-01-01T00:00:00Z | 2024-01-01T00:00:00Z |
| `UUID-2` | หนังสือเดินทาง | เดินทาง | `passport` | me@email.com | 2019-05-10 | 2029-05-10 | 60 | FILE_ID_2 | https://drive.google.com/open?id=FILE_ID_2 | `[{"version":"v1","fileId":"FILE_ID_2","fileUrl":"https://drive.google.com/open?id=FILE_ID_2","fileName":"passport.pdf","uploadedAt":"2024-01-02T00:00:00Z"}]` | ตู้นิรภัย | สแกน | active | เตือนต่ออายุ | 2024-01-02T00:00:00Z | 2024-01-02T00:00:00Z |
| `UUID-3` | ประกันสุขภาพ | ประกัน | `insurance,health` | owner@email.com | 2023-01-01 | 2024-12-31 | 45 | FILE_ID_3|FILE_ID_4 | https://drive.google.com/open?id=FILE_ID_3|https://drive.google.com/open?id=FILE_ID_4 | `[{"version":"v1","fileId":"FILE_ID_3","fileUrl":"https://drive.google.com/open?id=FILE_ID_3","fileName":"policy.pdf","uploadedAt":"2024-01-03T00:00:00Z"},{"version":"v2","fileId":"FILE_ID_4","fileUrl":"https://drive.google.com/open?id=FILE_ID_4","fileName":"policy-update.pdf","uploadedAt":"2024-03-01T00:00:00Z"}]` | กล่องเอกสาร | ส่งอีเมล | active | แนบสองไฟล์ | 2024-01-03T00:00:00Z | 2024-03-01T00:00:00Z |

## ขั้นตอนติดตั้ง / Deploy

1. **สร้างโปรเจกต์ Google Apps Script** → สร้างไฟล์ใหม่ `Code.gs`, `Api.gs`, `Triggers.gs`, `index.html` แล้วคัดลอกโค้ดจาก repo นี้ไปวาง
2. ไปที่เมนู `Deploy > Test deployments` หรือ `Deploy > Web app` → ตั้งค่า Execute as = "Me" และ Who has access = "Only myself" (หรือปรับตามต้องการ) → Deploy และคัดลอก URL
3. เปิด URL เว็บแอป → เข้าเมนู Settings → กดปุ่ม **"สร้างชีต & โฟลเดอร์"** (หรือ **"บังคับสร้างใหม่"**) เพื่อให้สคริปต์สร้าง Spreadsheet + Drive Folder พร้อมตั้ง Script Properties (`SHEET_ID`, `SHEET_NAME`, `DRIVE_FOLDER_ID`) และเพิ่มข้อมูลตัวอย่างให้อัตโนมัติ
4. ตั้งรหัสผ่านผู้ดูแล (กรอกในช่อง Admin แล้วกดปลดล็อก หรือกำหนดใน Script Properties ชื่อ `ADMIN_PASS` หากต้องการกำหนดภายหลัง)
5. ยืนยันที่ Settings ว่า `Sheet ID` และ `Drive Folder ID` ถูกตั้งค่า → กลับหน้า Dashboard ทดลองเพิ่ม/แก้ไข/อัปโหลดไฟล์ → ตรวจว่าไฟล์ถูกสร้างในโฟลเดอร์ Drive และข้อมูลลงชีตถูกต้อง
6. ไปหน้า Settings → กดปุ่ม **"สร้าง Trigger อัตโนมัติ"** เพื่อสร้างทริกเกอร์เตือนรายวันและสำรองรายสัปดาห์
7. ใส่ข้อมูลตัวอย่างที่มี expiry ใกล้ถึง → ทดลองเรียกเมนู **Health Check (Ping)** หรือเรียกฟังก์ชัน `handleApiRequest('remindCheck', {})` ใน Apps Script เพื่อดูตัวอย่างอีเมลแจ้งเตือน

## ฟีเจอร์หลัก

- ✅ อัปโหลดไฟล์หลายไฟล์ → เก็บใน Drive (คั่นหลายไฟล์ด้วย `|` ที่ชีต) พร้อมสร้าง version history
- ✅ CRUD ครบ: สร้าง/แก้ไข/Archive ผ่าน UI (ปุ่มจะถูกปิดถ้าไม่ได้ปลดล็อกโหมดผู้ดูแล)
- ✅ ค้นหา/กรอง/เรียง/แบ่งหน้า รองรับ keyword, สถานะ, ช่วงวันที่, และสลับมุมมองตาราง/การ์ด
- ✅ แจ้งเตือนหมดอายุผ่านทริกเกอร์รายวัน (MailApp) พร้อมแนบลิงก์เอกสารและไฟล์
- ✅ สำรองข้อมูลรายสัปดาห์ + ปุ่มกดสำรองทันที + ปุ่ม Export CSV/JSON
- ✅ ความปลอดภัยเบื้องต้น: ปลดล็อกด้วยรหัสผ่านผู้ดูแลก่อนแก้ไขข้อมูล, Properties Service เก็บค่า ID/Secret
- ✅ UX/UI Mobile-first พร้อมแดชบอร์ดใหม่, Dark mode, Toast แจ้งเตือน, Badge สีสถานะ, Drag & Drop อัปโหลดไฟล์, ปุ่มคัดลอกลิงก์/พิมพ์, มุมมอง Table/Card สวยงาม
- ✅ Logging: `console.log` ฝั่ง client และ `Logger.log` ในทุก action ฝั่ง server
- ✅ Health Check: เรียก `action=ping` จะคืน `{ok:true}` พร้อม timestamp

## วิธีทดสอบ Health Check (Ping)

ใช้ `curl` กับ URL ของเว็บแอป (POST JSON):

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"ping"}' \
  "https://script.google.com/macros/s/DEPLOYMENT_ID/exec"
```

ผลลัพธ์ที่คาดหวัง:

```json
{"ok":true,"data":{"timestamp":"2024-01-01T00:00:00.000Z","app":"{{APP_NAME}}"}}
```

หรือทดสอบใน UI ที่หน้า Settings → ปุ่ม **Health Check**

## เคล็ดลับเพิ่มเติม

- ตั้งสิทธิ์การเข้าถึงโฟลเดอร์ Drive และชีตให้ตรงกับผู้ใช้งานเว็บแอป
- หากต้องปรับช่วงเวลาทริกเกอร์ แก้ที่ `Triggers.gs`
- ตรวจสอบโควต้า Apps Script (MailApp, DriveApp) หากมีไฟล์หรืออีเมลจำนวนมาก
- สามารถกำหนด default values เพิ่มเติมใน `appState().resetForm()` เพื่อความสะดวก
- หากต้องการขยาย API ให้รองรับ batch operations สามารถเพิ่ม action ใน `handleApiRequest`
- ใช้ `action=provisionWorkspace` (payload: `{forceNewSheet, forceNewFolder, adminPass}`) เพื่อให้สคริปต์สร้าง/รีเซ็ต Spreadsheet และ Drive Folder อัตโนมัติพร้อมข้อมูลตัวอย่าง
- เมื่อเชื่อมต่อเฉพาะ Google Sheet (ยังไม่ตั้งค่าโฟลเดอร์) ระบบยังสามารถโหลดข้อมูลและค้นหาได้ทันทีผ่านสถานะ `readyForData`
- หากมีข้อมูลเก่าอยู่แล้วเพียงตั้งค่า `SHEET_ID` ให้ถูกต้อง ระบบจะพยายามจับคู่แท็บที่มีหัวตารางตามสคีมาให้อัตโนมัติก่อนสร้างชีตใหม่ ช่วยป้องกันปัญหา “มีข้อมูลในชีตแต่หน้าเว็บไม่แสดง”
