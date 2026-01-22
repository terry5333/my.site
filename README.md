flowchart LR
  U[使用者/訪客] -->|開網站| V[Vercel\nVite 靜態站]
  V -->|載入前端| FE[Frontend\nindex.html + main.js + styles.css]

  FE -->|Google 登入| AUTH[Firebase Auth]
  FE -->|讀取作品/社群| FS[(Firestore\nprojects / site-social)]
  FE -->|上傳縮圖| ST[(Firebase Storage\nthumbs/...)]

  AUTH -->|回傳 user.uid| FE
  FE -->|若 user.uid == VITE_ADMIN_UID\n顯示新增/編輯/刪除| FE
  FE -->|寫入/更新/刪除作品| FS
  FE -->|取得縮圖 URL| ST
  ST -->|downloadURL| FE
  FS -->|onSnapshot 即時更新| FE
