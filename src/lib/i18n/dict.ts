// All translatable strings for the guest surface. Admin stays in English
// for now — it's a low-traffic internal tool.

export const LANGUAGES = ["en", "zh-Hant"] as const;
export type Lang = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Lang, string> = {
  en: "English",
  "zh-Hant": "繁中",
};

export interface Dict {
  eyebrow: string;
  yourName: string;
  optional: string;
  yourNamePlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
  challengesLabel: string;
  choosePhotos: string;
  chooseHelp: (max: number) => string;
  changePhotos: string;
  addMorePhotos: string;
  send: (count: number) => string;
  sending: (done: number, total: number) => string;
  privacyNote: (perGuest: number) => string;
  myUploadsHeading: (n: number) => string;
  thanksTitle: string;
  thanksBody: (sent: number) => string;
  thanksFailed: (failed: number) => string;
  addMore: string;
  closedTitle: string;
  closedBody: string;
  tableBadge: (label: string) => string;
  slideshowTitle: string;
  slideshowEyebrow: string;
  slideshowWaiting: string;
  slideshowCounter: (current: number, total: number) => string;
  wallPhotoCount: (n: number) => string;
  slideshowNewToast: (n: number) => string;
  msgModeText: string;
  msgModeVoice: string;
  voiceSent: (n: number) => string;
  voiceClipHeading: (n: number) => string;
  voiceClipDuration: (sec: number) => string;
  voiceClipDelete: string;
  voiceClipDeleting: string;
  voiceClipDeleteConfirm: string;
  micDenied: string;
  recStart: string;
  recStop: string;
  recRerecord: string;
  recRecordAnother: string;
  recSend: string;
  retry: string;
  errUnsupported: (name: string) => string;
  errOverSize: (name: string) => string;
  errVideoTooLong: (name: string) => string;
  errTruncated: (max: number) => string;
}

export const DICT: Record<Lang, Dict> = {
  en: {
    eyebrow: "Wedding photo sharing",
    yourName: "Your name",
    optional: "(optional)",
    yourNamePlaceholder: "e.g. Aunt Linda",
    messageLabel: "Leave a message",
    messagePlaceholder: "A short note for the couple…",
    challengesLabel: "Photo challenge",
    choosePhotos: "Choose photos or short videos",
    chooseHelp: (max) =>
      `Photos or videos (under 30s) · up to ${max} at a time`,
    changePhotos: "Change photos",
    addMorePhotos: "Add more",
    send: (count) =>
      `Send ${count} photo${count === 1 ? "" : "s"}`,
    sending: (done, total) => `Sending… ${done}/${total}`,
    privacyNote: (perGuest) =>
      `Up to ${perGuest} photos per guest. Your photos are private to the couple.`,
    myUploadsHeading: (n) =>
      `You've shared ${n} photo${n === 1 ? "" : "s"} — thank you!`,
    thanksTitle: "Thank you!",
    thanksBody: (sent) =>
      `${sent} photo${sent === 1 ? "" : "s"} sent to the couple.`,
    thanksFailed: (failed) =>
      ` ${failed} couldn’t be sent — please try those again.`,
    addMore: "Add more photos",
    closedTitle: "Photo sharing is closed",
    closedBody:
      "Thank you for being part of this day. The couple has closed photo uploads — they have everything they need.",
    tableBadge: (label) => `Table · ${label}`,
    slideshowTitle: "Slideshow",
    slideshowEyebrow: "Wedding photo sharing",
    slideshowWaiting: "Waiting for the first photo from your guests…",
    slideshowCounter: (current, total) => `${current} / ${total}`,
    wallPhotoCount: (n) => `${n} photo${n === 1 ? "" : "s"}`,
    slideshowNewToast: (n) =>
      `${n} new photo${n === 1 ? "" : "s"}`,
    msgModeText: "Text",
    msgModeVoice: "Voice",
    voiceSent: (n) => `${n} voice message${n === 1 ? "" : "s"} sent`,
    voiceClipHeading: (n) =>
      `Sent voice message${n === 1 ? "" : "s"} (${n})`,
    voiceClipDuration: (sec) => `${sec}s`,
    voiceClipDelete: "Delete & re-record",
    voiceClipDeleting: "Removing…",
    voiceClipDeleteConfirm:
      "Delete this voice message? You can record a new one after.",
    micDenied: "Microphone access denied. Please allow access to record.",
    recStart: "Start recording",
    recStop: "Stop",
    recRerecord: "Re-record",
    recRecordAnother: "Record another",
    recSend: "Send",
    retry: "Retry",
    errUnsupported: (name) => `${name}: unsupported format`,
    errOverSize: (name) => `${name}: file too large`,
    errVideoTooLong: (name) => `${name}: video over 30 seconds`,
    errTruncated: (max) => `Only the first ${max} photos were added.`,
  },
  "zh-Hant": {
    eyebrow: "婚禮相片分享",
    yourName: "您的稱呼",
    optional: "（選填）",
    yourNamePlaceholder: "例如:阿姨",
    messageLabel: "留言給新人",
    messagePlaceholder: "寫幾句祝福的話…",
    challengesLabel: "相片任務",
    choosePhotos: "選擇相片或短片",
    chooseHelp: (max) =>
      `相片或短片(30 秒以內) · 每次最多 ${max} 個`,
    changePhotos: "更換相片",
    addMorePhotos: "新增相片",
    send: (count) => `傳送 ${count} 張相片`,
    sending: (done, total) => `傳送中… ${done}/${total}`,
    privacyNote: (perGuest) =>
      `每位賓客最多 ${perGuest} 張。您的相片只有新人會看到。`,
    myUploadsHeading: (n) => `您已分享 ${n} 張相片 — 多謝您!`,
    thanksTitle: "謝謝您!",
    thanksBody: (sent) => `已成功傳送 ${sent} 張相片給新人。`,
    thanksFailed: (failed) => ` 還有 ${failed} 張未能傳送,請再試一次。`,
    addMore: "再加幾張",
    closedTitle: "相片分享已關閉",
    closedBody:
      "謝謝您參與這個美好的日子。新人已經收到足夠的相片,不再開放上傳。",
    tableBadge: (label) => `座位 · ${label}`,
    slideshowTitle: "投影播放",
    slideshowEyebrow: "婚禮相片分享",
    slideshowWaiting: "等待第一張賓客相片…",
    slideshowCounter: (current, total) => `${current} / ${total}`,
    wallPhotoCount: (n) => `${n} 張相片`,
    slideshowNewToast: (n) => `${n} 張新相片`,
    msgModeText: "文字",
    msgModeVoice: "語音",
    voiceSent: (n) => `已送出 ${n} 段語音留言`,
    voiceClipHeading: (n) => `已送出嘅語音(${n})`,
    voiceClipDuration: (sec) => `${sec} 秒`,
    voiceClipDelete: "刪除並重新錄製",
    voiceClipDeleting: "移除中…",
    voiceClipDeleteConfirm: "確定刪除呢段語音?之後可以再錄一段。",
    micDenied: "無法存取麥克風,請允許瀏覽器使用麥克風。",
    recStart: "開始錄音",
    recStop: "停止",
    recRerecord: "重新錄製",
    recRecordAnother: "再錄一段",
    recSend: "送出",
    retry: "重試",
    errUnsupported: (name) => `${name}:不支援的格式`,
    errOverSize: (name) => `${name}:檔案太大`,
    errVideoTooLong: (name) => `${name}:短片超過 30 秒`,
    errTruncated: (max) => `只加入了前 ${max} 個。`,
  },
};
