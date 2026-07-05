"use client";

import { useTransition } from "react";

import { ADMIN_DICT } from "@/lib/i18n/admin-dict";
import type { Lang } from "@/lib/i18n";
import { deleteChallengeAction } from "./actions";

interface Props {
  lang: Lang;
  eventId: string;
  challengeId: string;
  prompt: string;
}

export function DeleteChallengeButton({
  lang,
  eventId,
  challengeId,
  prompt,
}: Props) {
  const t = ADMIN_DICT[lang];
  const [pending, startTransition] = useTransition();

  function run() {
    if (!window.confirm(t.removeChallengeConfirm(prompt))) return;
    startTransition(async () => {
      await deleteChallengeAction({ eventId, challengeId });
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="text-[11px] text-ink-700 hover:text-blush-700 disabled:opacity-60 transition"
    >
      {pending ? t.removeChallengePending : t.removeChallenge}
    </button>
  );
}
