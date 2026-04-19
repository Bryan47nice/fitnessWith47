---
name: firestore-rules
description: FitForge Firestore 資料結構與安全規範，適用 Firebase 相關檔案
paths: firestore.rules, src/firebase.js, functions/index.js
---

## Firestore 資料結構

```
users/{userId}/
  ├── workouts/{id}           → { date, exercise, sets, note, createdAt }
  ├── bodyData/{date}         → { weight, height, waist, hip, bodyfat, muscle_mass, visceral_fat, createdAt }
  │                              ↑ date 字串為 doc ID（v1.2.2 起，同日覆蓋機制）
  │                              ↑ v1.8.1：移除 chest/arm/thigh，新增 bodyfat/muscle_mass/visceral_fat
  ├── customExercises/{id}    → { name, createdAt }
  ├── meta/streak             → { count, lastDate }
  ├── coachDays/{YYYY-MM-DD}  → { date, createdAt }
  └── meta/coachQuota         → { total: 24 }

userPushTokens/{userId}       → { fcmToken, lastActiveAt, lastNotifiedAt }
```

## 安全規範（強制）

- 禁止將未驗證的用戶輸入直接寫入 Firestore
- 所有寫入操作必須確認 `auth.uid === userId`
- 新增 collection 或欄位時，必須同步更新 `firestore.rules` 的規則
