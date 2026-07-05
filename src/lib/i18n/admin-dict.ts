// Admin-side translation dictionary. Keyed on the same Lang type as the
// guest dict so a single switcher can flip both halves of the site.

import type { Lang } from "./index";

export interface AdminDict {
  // ── Layout / chrome ────────────────────────────────────────────
  brand: string;
  signOut: string;
  backToPhotos: string;

  // ── Events list ────────────────────────────────────────────────
  yourEvents: string;
  newEventCta: string;
  statusOpen: string;
  statusClosed: string;
  eventsEmptyTitle: string;
  eventsEmptyBody: string;
  eventsEmptyCta: string;

  // ── New event form ─────────────────────────────────────────────
  newEventHeading: string;
  newEventSubtitle: string;
  formCoupleNames: string;
  formCoupleNamesPlaceholder: string;
  formUrlSlug: string;
  formUrlSlugHint: string;
  formUrlSlugPlaceholder: string;
  formEventDate: string;
  formWelcomeMessage: string;
  formWelcomePlaceholder: string;
  createEventPending: string;
  createEventCta: string;
  errSlugFormat: string;
  errSlugTaken: string;

  // ── Event dashboard ────────────────────────────────────────────
  uploadsOpen: string;
  uploadsClosed: string;
  navSlideshow: string;
  navSlideshowTitle: string;
  navWall: string;
  navWallTitle: string;
  navDownloadAll: string;
  navDownloadAllTitle: string;
  navQr: string;
  navPoster: string;
  navTables: string;
  navChallenges: string;
  navSettings: string;
  eventNotFound: string;

  // ── Live status badge ──────────────────────────────────────────
  liveConnecting: string;
  liveLive: string;
  liveOffline: string;
  photoCount: (n: number) => string;

  // ── Stats row ──────────────────────────────────────────────────
  statPhotos: string;
  statGuests: string;
  statMessages: string;
  statTables: string;

  // ── Media grid ─────────────────────────────────────────────────
  filterAll: string;
  loadingMore: string;
  loadMore: (left: number) => string;
  gridEmpty: string;
  gridEmptyFiltered: string;
  tileNew: string;
  tileHidden: string;
  tileVideo: string;
  modalDownload: string;
  modalHide: string;
  modalUnhide: string;
  modalDelete: string;
  modalClose: string;

  // ── Messages panel ─────────────────────────────────────────────
  messagesHeading: (n: number) => string;
  guestPlaceholder: string;
  removeMessagePending: string;
  removeMessage: string;

  // ── Settings ───────────────────────────────────────────────────
  settingsHeading: string;
  settingsSubtitle: string;
  slugLabel: string;
  formMaxUploads: string;
  acceptUploads: string;
  acceptUploadsHint: string;
  primaryColor: string;
  primaryColorHint: string;
  primaryColorReset: string;
  saved: string;
  savePending: string;
  saveCta: string;

  // Cover image
  coverHeading: string;
  coverHint: string;
  coverEmpty: string;
  coverUploading: string;
  coverRemovePending: string;
  coverRemove: string;

  // Cleanup panel
  cleanupHeading: string;
  cleanupHint: string;
  cleanupConfirm: string;
  cleanupResult: (orphans: number, stale: number) => string;
  cleanupPending: string;
  cleanupCta: string;

  // ── Tables admin ───────────────────────────────────────────────
  tablesHeading: string;
  tablesSubtitle: string;
  tablesEmpty: string;
  tableLabel: string;
  tableLabelPlaceholder: string;
  addTablePending: string;
  addTableCta: string;
  removeTablePending: string;
  removeTable: string;
  removeTableConfirm: (label: string) => string;
  errTableExists: string;

  // ── Challenges admin ───────────────────────────────────────────
  challengesHeading: string;
  challengesSubtitle: string;
  challengesEmpty: string;
  challengePromptPlaceholder: string;
  addChallengePending: string;
  addChallengeCta: string;
  removeChallengePending: string;
  removeChallenge: string;
  removeChallengeConfirm: (prompt: string) => string;
  errChallengeExists: string;
  challengeSuggestionsLabel: string;
  challengeSuggestions: string[];

  // ── QR page ────────────────────────────────────────────────────
  qrScanInstruction: string;
  qrTabSign: string;
  qrTabThankYou: string;
  qrThankYouMessage: string;
  qrThankYouHint: string;
  printCta: string;

  // ── Poster ─────────────────────────────────────────────────────
  posterHeading: string;
  posterSubtitle: string;
  posterTemplateMinimal: string;
  posterTemplatePhoto: string;
  posterTemplateOrnate: string;
  posterScanInstruction: string;
  posterPickTemplate: string;

  // ── Login / signup ─────────────────────────────────────────────
  loginEyebrow: string;
  loginHeading: string;
  loginEmail: string;
  loginPassword: string;
  loginInviteCode: string;
  loginInviteCodeHint: string;
  signInPending: string;
  signInCta: string;
  signUpPending: string;
  signUpCta: string;
  toggleToSignUp: string;
  toggleToSignIn: string;

  // ── Generic errors (machine codes → human messages) ───────────
  errInvalidRequest: string;
  errNotFound: string;
  errForbidden: string;
  errNotSignedIn: string;
  errInvalidCredentials: string;
  errSignupsClosed: string;
  errSignupValidation: string;
  errInvalidInvite: string;
  errEmailInUse: string;
  errRateLimited: string;
  errAuthFailed: string;
  errCheckEmail: string;
  errCoverNoFile: string;
  errCoverUnsupported: string;
  errCoverTooLarge: string;
}

export const ADMIN_DICT: Record<Lang, AdminDict> = {
  "zh-Hant": {
    brand: "婚禮相片分享",
    signOut: "登出",
    backToPhotos: "← 返回相片",

    yourEvents: "您的活動",
    newEventCta: "新增活動",
    statusOpen: "開放中",
    statusClosed: "已關閉",
    eventsEmptyTitle: "還未有活動",
    eventsEmptyBody: "建立您的第一個活動,印 QR code 開始收集相片。",
    eventsEmptyCta: "建立活動",

    newEventHeading: "新增活動",
    newEventSubtitle: "之後可以再修改這些資料。",
    formCoupleNames: "新人姓名",
    formCoupleNamesPlaceholder: "例:Dannis & Aimee",
    formUrlSlug: "URL slug",
    formUrlSlugHint: "用作 QR 連結,例如 /e/dannis-and-aimee-2026",
    formUrlSlugPlaceholder: "dannis-and-aimee-2026",
    formEventDate: "婚禮日期",
    formWelcomeMessage: "歡迎訊息",
    formWelcomePlaceholder: "與我們分享您鏡頭裡的精彩時刻!",
    createEventPending: "建立中…",
    createEventCta: "建立活動",
    errSlugFormat: "Slug 須 3–64 字,只可細楷字母、數字、連字號,首尾唔可以係連字號。",
    errSlugTaken: "呢個 URL 已經被用咗 — 請試另一個。",

    uploadsOpen: "開放上傳中",
    uploadsClosed: "上傳已關閉",
    navSlideshow: "投影模式",
    navSlideshowTitle: "新分頁開啟投影模式 — 投放去婚宴投影機",
    navWall: "相片牆",
    navWallTitle: "即時相片牆 — 多張新相同時上牆,鼓勵賓客上傳",
    navDownloadAll: "全部下載",
    navDownloadAllTitle: "下載所有可見相片(ZIP)",
    navQr: "QR",
    navPoster: "海報",
    navTables: "座位",
    navChallenges: "相片任務",
    navSettings: "設定",
    eventNotFound: "找不到活動。",

    liveConnecting: "連線中…",
    liveLive: "即時",
    liveOffline: "已斷線",
    photoCount: (n) => `${n} 張相片`,

    statPhotos: "相片",
    statGuests: "賓客",
    statMessages: "留言",
    statTables: "座位",

    filterAll: "全部",
    loadingMore: "載入中…",
    loadMore: (left) => `載入更多(尚餘 ${left} 張)`,
    gridEmpty: "暫未有相片。將 QR code 分享俾賓客就會開始收到。",
    gridEmptyFiltered: "呢張枱暫時未有相片。",
    tileNew: "新到",
    tileHidden: "已隱藏",
    tileVideo: "短片",
    modalDownload: "下載",
    modalHide: "隱藏",
    modalUnhide: "取消隱藏",
    modalDelete: "刪除",
    modalClose: "關閉",

    messagesHeading: (n) => `留言 (${n})`,
    guestPlaceholder: "賓客",
    removeMessagePending: "移除中…",
    removeMessage: "移除",

    settingsHeading: "設定",
    settingsSubtitle: "活動建立後,URL slug 唔可以再改。",
    slugLabel: "Slug",
    formMaxUploads: "每位賓客最多上傳數量",
    acceptUploads: "接受新上傳",
    acceptUploadsHint: "收齊相之後可以關咗。已收到嘅相片仍然可以睇。",
    primaryColor: "主題色",
    primaryColorHint: "套用喺賓客上傳頁嘅標籤同主要按鈕。揀一個配合請帖嘅顏色。",
    primaryColorReset: "回復預設",
    saved: "已儲存。",
    savePending: "儲存中…",
    saveCta: "儲存變更",

    coverHeading: "封面相",
    coverHint: "賓客上傳頁頂部嘅主視覺。橫向(16:9)最佳,25 MB 以內。支援 JPEG、PNG、WebP、HEIC。",
    coverEmpty: "未設定封面相",
    coverUploading: "上傳中…",
    coverRemovePending: "移除中…",
    coverRemove: "移除",

    cleanupHeading: "儲存空間維護",
    cleanupHint: "永久移除您刪除咗嘅相片同上傳失敗嘅檔案。整理好相簿之後跑一次。",
    cleanupConfirm: "呢個操作會永久刪除所有您隱藏 / 刪除嘅相片,以及上傳失敗嘅零碎檔案。冇得復原。確定?",
    cleanupResult: (orphans, stale) =>
      `已移除 ${orphans} 個失敗檔案、${stale} 張刪除嘅相片。`,
    cleanupPending: "清理中…",
    cleanupCta: "清理儲存空間",

    tablesHeading: "每張枱嘅 QR Code",
    tablesSubtitle:
      "每張枱印一個 QR。從某張枱上傳嘅相片會自動加標籤 — 之後可以按枱數篩選。",
    tablesEmpty:
      "未有座位。加 label(例如 1、2、A、Garden),每個會即時產生可印嘅 QR。",
    tableLabel: "座位",
    tableLabelPlaceholder: "座位 label(例如 1、A、Garden)",
    addTablePending: "新增中…",
    addTableCta: "加座位",
    removeTablePending: "移除中…",
    removeTable: "移除",
    removeTableConfirm: (label) =>
      `確定移除座位「${label}」?已有嘅相片仍然會保留座位標籤。`,
    errTableExists: "呢個 label 已經存在。",

    challengesHeading: "相片任務",
    challengesSubtitle:
      "俾賓客一啲影相提示,推高上傳量、影到攝影師影唔到嘅畫面。賓客上傳時可以揀一個任務,相片會自動標籤。",
    challengesEmpty:
      "未有任務。加幾個提示(例如「同最年長嘅賓客合照」),賓客上傳頁就會出現任務俾佢哋揀。",
    challengePromptPlaceholder: "任務提示(例如:同新人自拍一張)",
    addChallengePending: "新增中…",
    addChallengeCta: "加任務",
    removeChallengePending: "移除中…",
    removeChallenge: "移除",
    removeChallengeConfirm: (prompt) =>
      `確定移除任務「${prompt}」?已上傳嘅相片仍然保留標籤。`,
    errChallengeExists: "呢個任務已經存在。",
    challengeSuggestionsLabel: "快速加入:",
    challengeSuggestions: [
      "同新人自拍一張",
      "影低你嗰檯嘅大合照",
      "捕捉一個笑到最開心嘅人",
      "同最年長嘅賓客合照",
      "影低你最鍾意嘅佈置細節",
      "舞池上最放嘅一刻",
    ],

    qrScanInstruction: "掃 QR 將相片送俾新人",
    qrTabSign: "掛牌",
    qrTabThankYou: "感謝卡插卡",
    qrThankYouMessage:
      "多謝您與我們共度美好一天!如果您影低咗任何時刻,掃碼補傳俾我哋留念。",
    qrThankYouHint:
      "一頁 A4 印四張,沿虛線剪開,夾入感謝卡 — 當日未掃碼嘅賓客可以事後補傳。",
    printCta: "列印",

    posterHeading: "可列印海報",
    posterSubtitle:
      "為您嘅婚宴設計精美嘅 QR 海報。揀一個版型,印出嚟擺喺接待處或者每張枱。",
    posterTemplateMinimal: "極簡",
    posterTemplatePhoto: "封面相版",
    posterTemplateOrnate: "華麗版",
    posterScanInstruction: "掃描分享您嘅相片",
    posterPickTemplate: "揀版型:",

    loginEyebrow: "管理員",
    loginHeading: "登入",
    loginEmail: "電郵",
    loginPassword: "密碼",
    loginInviteCode: "邀請碼",
    loginInviteCodeHint: "向新人或現有管理員索取。",
    signInPending: "登入中…",
    signInCta: "登入",
    signUpPending: "建立帳號中…",
    signUpCta: "建立帳號",
    toggleToSignUp: "未有帳號?建立一個",
    toggleToSignIn: "已有帳號?去登入",

    errInvalidRequest: "請求格式錯誤。",
    errNotFound: "找不到。",
    errForbidden: "冇權限。",
    errNotSignedIn: "請先登入。",
    errInvalidCredentials: "電郵或密碼錯誤。",
    errSignupsClosed:
      "註冊已關閉。請聯絡現有管理員加你入去,或設定 ADMIN_SIGNUP_INVITE_CODE。",
    errSignupValidation: "電郵、密碼(8+ 字)同邀請碼三樣都必須填。",
    errInvalidInvite: "邀請碼錯誤。",
    errEmailInUse: "呢個電郵已經註冊咗,請直接登入。",
    errRateLimited: "嘗試太頻密,請稍後再試。",
    errAuthFailed: "登入失敗,請稍後再試。",
    errCheckEmail: "請查看電郵確認帳號,然後返嚟登入。",
    errCoverNoFile: "請揀一個檔案。",
    errCoverUnsupported: "唔支援呢種格式。",
    errCoverTooLarge: "檔案太大。",
  },

  en: {
    brand: "Wedding photo sharing",
    signOut: "Sign out",
    backToPhotos: "← Back to photos",

    yourEvents: "Your events",
    newEventCta: "New event",
    statusOpen: "Open",
    statusClosed: "Closed",
    eventsEmptyTitle: "No events yet",
    eventsEmptyBody:
      "Create your first event to print a QR code and start collecting photos.",
    eventsEmptyCta: "Create event",

    newEventHeading: "New event",
    newEventSubtitle: "You can change these details later.",
    formCoupleNames: "Couple's names",
    formCoupleNamesPlaceholder: "e.g. Dannis & Aimee",
    formUrlSlug: "URL slug",
    formUrlSlugHint: "Used in the QR link, e.g. /e/dannis-and-aimee-2026",
    formUrlSlugPlaceholder: "dannis-and-aimee-2026",
    formEventDate: "Event date",
    formWelcomeMessage: "Welcome message",
    formWelcomePlaceholder: "Share your favourite photos with us!",
    createEventPending: "Creating…",
    createEventCta: "Create event",
    errSlugFormat:
      "Slug must be 3–64 chars, lowercase letters, digits or hyphens, no leading/trailing hyphen.",
    errSlugTaken: "That URL is already taken — try another.",

    uploadsOpen: "Uploads open",
    uploadsClosed: "Uploads closed",
    navSlideshow: "Slideshow",
    navSlideshowTitle:
      "Open slideshow in a new tab — mirror to your venue projector",
    navWall: "Photo wall",
    navWallTitle:
      "Live photo wall — many new photos at once, nudges guests to upload",
    navDownloadAll: "Download all",
    navDownloadAllTitle: "Download all visible photos as ZIP",
    navQr: "QR",
    navPoster: "Poster",
    navTables: "Tables",
    navChallenges: "Challenges",
    navSettings: "Settings",
    eventNotFound: "Event not found.",

    liveConnecting: "Connecting…",
    liveLive: "Live",
    liveOffline: "Disconnected",
    photoCount: (n) => `${n} photo${n === 1 ? "" : "s"}`,

    statPhotos: "Photos",
    statGuests: "Guests",
    statMessages: "Messages",
    statTables: "Tables",

    filterAll: "All",
    loadingMore: "Loading…",
    loadMore: (left) => `Load more (${left} left)`,
    gridEmpty: "No photos yet. Share the QR code with your guests to start.",
    gridEmptyFiltered: "No photos from this table yet.",
    tileNew: "New",
    tileHidden: "Hidden",
    tileVideo: "Video",
    modalDownload: "Download",
    modalHide: "Hide",
    modalUnhide: "Unhide",
    modalDelete: "Delete",
    modalClose: "Close",

    messagesHeading: (n) => `Messages (${n})`,
    guestPlaceholder: "Guest",
    removeMessagePending: "Removing…",
    removeMessage: "Remove",

    settingsHeading: "Settings",
    settingsSubtitle:
      "The URL slug can't be changed once an event has been created.",
    slugLabel: "Slug",
    formMaxUploads: "Max uploads per guest",
    acceptUploads: "Accept new uploads",
    acceptUploadsHint:
      "Turn off when you've collected enough photos. Existing photos stay visible to you.",
    primaryColor: "Primary color",
    primaryColorHint:
      "Applied to the upload page header and primary button. Pick a shade that matches your invitations.",
    primaryColorReset: "Reset to default",
    saved: "Saved.",
    savePending: "Saving…",
    saveCta: "Save changes",

    coverHeading: "Cover image",
    coverHint:
      "A hero image at the top of the upload page. Best in landscape (16:9). Under 25 MB. JPEG, PNG, WebP, or HEIC.",
    coverEmpty: "No cover image yet",
    coverUploading: "Uploading…",
    coverRemovePending: "Removing…",
    coverRemove: "Remove",

    cleanupHeading: "Storage maintenance",
    cleanupHint:
      "Permanently remove deleted photos and stray uploads. Run this once you've finished curating the album.",
    cleanupConfirm:
      "This permanently removes any photos you've deleted, plus any stray uploads that never finished. There is no undo. Continue?",
    cleanupResult: (orphans, stale) =>
      `Removed ${orphans} stray upload${orphans === 1 ? "" : "s"} and ${stale} deleted photo${stale === 1 ? "" : "s"}.`,
    cleanupPending: "Cleaning up…",
    cleanupCta: "Clean up storage",

    tablesHeading: "Per-table QR codes",
    tablesSubtitle:
      "Print one QR per table. Photos uploaded from each table get tagged automatically — you can filter the gallery by table later.",
    tablesEmpty:
      "No tables yet. Add table labels (e.g. 1, 2, A, Garden) and a printable QR will appear for each.",
    tableLabel: "Table",
    tableLabelPlaceholder: "Table label (e.g. 1, A, Garden)",
    addTablePending: "Adding…",
    addTableCta: "Add table",
    removeTablePending: "Removing…",
    removeTable: "Remove",
    removeTableConfirm: (label) =>
      `Remove table "${label}"? Existing photos keep their tag.`,
    errTableExists: "Already exists.",

    challengesHeading: "Photo challenges",
    challengesSubtitle:
      "Give guests photo prompts — it drives uploads and captures moments the photographer can't. Guests pick a challenge when uploading; photos get tagged automatically.",
    challengesEmpty:
      "No challenges yet. Add a few prompts (e.g. “photo with the oldest guest”) and they'll appear on the guest upload page.",
    challengePromptPlaceholder: "Prompt (e.g. a selfie with the couple)",
    addChallengePending: "Adding…",
    addChallengeCta: "Add challenge",
    removeChallengePending: "Removing…",
    removeChallenge: "Remove",
    removeChallengeConfirm: (prompt) =>
      `Remove challenge "${prompt}"? Uploaded photos keep their tag.`,
    errChallengeExists: "That challenge already exists.",
    challengeSuggestionsLabel: "Quick add:",
    challengeSuggestions: [
      "A selfie with the couple",
      "A group photo of your table",
      "Someone laughing their hardest",
      "A photo with the oldest guest",
      "Your favourite décor detail",
      "The wildest dance-floor moment",
    ],

    qrScanInstruction: "Scan the code to share your photos",
    qrTabSign: "Table sign",
    qrTabThankYou: "Thank-you card insert",
    qrThankYouMessage:
      "Thank you for celebrating with us! If you captured any moments, we'd love to see them — scan to share.",
    qrThankYouHint:
      "Prints four per A4 page — cut along the dashed lines and tuck one into each thank-you card. Guests who never scanned at the venue can still upload later.",
    printCta: "Print",

    posterHeading: "Printable poster",
    posterSubtitle:
      "Design a beautiful QR poster for your wedding. Pick a template, print it, and place it at reception or on each table.",
    posterTemplateMinimal: "Minimal",
    posterTemplatePhoto: "With cover photo",
    posterTemplateOrnate: "Ornate",
    posterScanInstruction: "Scan to share your photos",
    posterPickTemplate: "Pick a template:",

    loginEyebrow: "Admin",
    loginHeading: "Sign in",
    loginEmail: "Email",
    loginPassword: "Password",
    loginInviteCode: "Invite code",
    loginInviteCodeHint: "Get this from the couple or an existing admin.",
    signInPending: "Signing in…",
    signInCta: "Sign in",
    signUpPending: "Creating account…",
    signUpCta: "Create account",
    toggleToSignUp: "Need an account? Create one",
    toggleToSignIn: "Already have an account? Sign in",

    errInvalidRequest: "Invalid request.",
    errNotFound: "Not found.",
    errForbidden: "Forbidden.",
    errNotSignedIn: "Please sign in first.",
    errInvalidCredentials: "Email or password is incorrect.",
    errSignupsClosed:
      "Signups are closed. Ask an existing admin to add you, or have them set ADMIN_SIGNUP_INVITE_CODE.",
    errSignupValidation:
      "Email, password (8+ chars), and invite code are all required.",
    errInvalidInvite: "Invalid invite code.",
    errEmailInUse: "That email is already registered — please sign in instead.",
    errRateLimited: "Too many attempts. Please try again in a moment.",
    errAuthFailed: "Sign-in failed. Please try again.",
    errCheckEmail: "Check your email to confirm your account, then sign in.",
    errCoverNoFile: "Please choose a file.",
    errCoverUnsupported: "Unsupported file format.",
    errCoverTooLarge: "File too large.",
  },
};

/**
 * Map a machine error code (e.g. "err_invalid_invite") to the localised
 * message. If the code isn't known, returns the input as-is so Supabase
 * passthrough errors (which are already human-readable strings) still
 * display sensibly.
 */
const ERR_KEY_MAP: Record<string, keyof AdminDict> = {
  err_invalid_request: "errInvalidRequest",
  invalid_request: "errInvalidRequest",
  not_found: "errNotFound",
  err_not_found: "errNotFound",
  forbidden: "errForbidden",
  err_forbidden: "errForbidden",
  not_signed_in: "errNotSignedIn",
  err_not_signed_in: "errNotSignedIn",
  err_invalid_credentials: "errInvalidCredentials",
  err_signups_closed: "errSignupsClosed",
  err_signup_validation: "errSignupValidation",
  err_invalid_invite: "errInvalidInvite",
  err_email_in_use: "errEmailInUse",
  err_rate_limited: "errRateLimited",
  err_auth_failed: "errAuthFailed",
  err_check_email: "errCheckEmail",
  err_cover_no_file: "errCoverNoFile",
  no_file: "errCoverNoFile",
  err_cover_unsupported: "errCoverUnsupported",
  unsupported_format: "errCoverUnsupported",
  err_cover_too_large: "errCoverTooLarge",
  file_too_large: "errCoverTooLarge",
  err_table_exists: "errTableExists",
  err_challenge_exists: "errChallengeExists",
  err_slug_format: "errSlugFormat",
  err_slug_taken: "errSlugTaken",
};

export function lookupAdminError(t: AdminDict, code: string): string {
  const key = ERR_KEY_MAP[code];
  if (!key) return code;
  const value = t[key];
  return typeof value === "string" ? value : code;
}
