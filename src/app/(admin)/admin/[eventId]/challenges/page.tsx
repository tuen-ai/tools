import Link from "next/link";
import { notFound } from "next/navigation";

import { requireEventAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEventById } from "@/lib/db/events";
import { listChallenges } from "@/lib/db/challenges";
import { resolveLangServer } from "@/lib/i18n/server";
import { ADMIN_DICT } from "@/lib/i18n/admin-dict";
import { SparkleIcon } from "@/components/ui/icons";
import { CreateChallengeForm } from "./create-form";
import { DeleteChallengeButton } from "./delete-button";

interface Props {
  params: Promise<{ eventId: string }>;
}

export default async function ChallengesPage({ params }: Props) {
  const { eventId } = await params;
  await requireEventAdmin(eventId);

  const admin = createAdminClient();
  const [event, lang] = await Promise.all([
    getEventById(admin, eventId),
    resolveLangServer(),
  ]);
  if (!event) notFound();
  const t = ADMIN_DICT[lang];

  const challenges = await listChallenges(admin, eventId);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <Link
          href={`/admin/${eventId}`}
          className="text-sm text-ink-700 hover:text-ink-900"
        >
          {t.backToPhotos}
        </Link>
      </div>

      <header>
        <h1 className="font-serif text-2xl text-ink-900">
          {t.challengesHeading}
        </h1>
        <p className="text-sm text-ink-700 mt-1">{t.challengesSubtitle}</p>
      </header>

      <CreateChallengeForm
        lang={lang}
        eventId={eventId}
        existingPrompts={challenges.map((c) => c.prompt)}
      />

      {challenges.length === 0 ? (
        <div className="bg-white rounded-3xl border border-cream-200 p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blush-400/15 text-blush-700">
            <SparkleIcon className="h-6 w-6" />
          </div>
          <p className="text-ink-700 text-sm">{t.challengesEmpty}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {challenges.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-cream-200 bg-white px-4 py-3"
            >
              <span className="inline-flex min-w-0 items-center gap-2 text-sm text-ink-900">
                <SparkleIcon className="h-4 w-4 shrink-0 text-blush-700" />
                <span className="truncate">{c.prompt}</span>
              </span>
              <DeleteChallengeButton
                lang={lang}
                eventId={eventId}
                challengeId={c.id}
                prompt={c.prompt}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
