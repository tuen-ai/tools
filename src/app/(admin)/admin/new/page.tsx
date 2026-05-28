import { NewEventForm } from "./form";

export const metadata = { title: "New event — Admin" };

export default function NewEventPage() {
  return (
    <div className="max-w-lg mx-auto">
      <header className="mb-6">
        <h1 className="font-serif text-2xl text-ink-900">New event</h1>
        <p className="text-sm text-ink-500 mt-1">
          You can change these details later.
        </p>
      </header>
      <NewEventForm />
    </div>
  );
}
