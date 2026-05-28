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
  choosePhotos: string;
  chooseHelp: (max: number) => string;
  changePhotos: string;
  send: (count: number) => string;
  sending: (done: number, total: number) => string;
  privacyNote: (perGuest: number) => string;
  thanksTitle: string;
  thanksBody: (sent: number) => string;
  thanksFailed: (failed: number) => string;
  addMore: string;
  closedTitle: string;
  closedBody: string;
  errUnsupported: (name: string) => string;
  errOverSize: (name: string) => string;
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
    choosePhotos: "Choose photos to share",
    chooseHelp: (max) =>
      `JPEG, PNG, WebP, or HEIC · up to ${max} at a time`,
    changePhotos: "Change photos",
    send: (count) =>
      `Send ${count} photo${count === 1 ? "" : "s"}`,
    sending: (done, total) => `Sending… ${done}/${total}`,
    privacyNote: (perGuest) =>
      `Up to ${perGuest} photos per guest. Your photos are private to the couple.`,
    thanksTitle: "Thank you!",
    thanksBody: (sent) =>
      `${sent} photo${sent === 1 ? "" : "s"} sent to the couple.`,
    thanksFailed: (failed) =>
      ` ${failed} couldn’t be sent — please try those again.`,
    addMore: "Add more photos",
    closedTitle: "Photo sharing is closed",
    closedBody:
      "Thank you for being part of this day. The couple has closed photo uploads — they have everything they need.",
    errUnsupported: (name) => `${name}: unsupported format`,
    errOverSize: (name) => `${name}: over 25 MB`,
    errTruncated: (max) => `Only the first ${max} photos were added.`,
  },
  "zh-Hant": {
    eyebrow: "婚禮相片分享",
    yourName: "您的稱呼",
    optional: "（選填）",
    yourNamePlaceholder: "例如:阿姨",
    messageLabel: "留言給新人",
    messagePlaceholder: "寫幾句祝福的話…",
    choosePhotos: "選擇相片分享",
    chooseHelp: (max) =>
      `JPEG、PNG、WebP 或 HEIC · 每次最多 ${max} 張`,
    changePhotos: "更換相片",
    send: (count) => `傳送 ${count} 張相片`,
    sending: (done, total) => `傳送中… ${done}/${total}`,
    privacyNote: (perGuest) =>
      `每位賓客最多 ${perGuest} 張。您的相片只有新人會看到。`,
    thanksTitle: "謝謝您!",
    thanksBody: (sent) => `已成功傳送 ${sent} 張相片給新人。`,
    thanksFailed: (failed) => ` 還有 ${failed} 張未能傳送,請再試一次。`,
    addMore: "再加幾張",
    closedTitle: "相片分享已關閉",
    closedBody:
      "謝謝您參與這個美好的日子。新人已經收到足夠的相片,不再開放上傳。",
    errUnsupported: (name) => `${name}:不支援的格式`,
    errOverSize: (name) => `${name}:超過 25 MB`,
    errTruncated: (max) => `只加入了前 ${max} 張。`,
  },
};
