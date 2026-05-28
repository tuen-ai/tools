export function ClosedScreen() {
  return (
    <div className="bg-white rounded-3xl shadow-soft p-8 text-center">
      <div className="text-5xl mb-4" aria-hidden>
        💐
      </div>
      <h2 className="font-serif text-xl text-ink-900 mb-2">
        Photo sharing is closed
      </h2>
      <p className="text-ink-500 text-sm leading-relaxed">
        Thank you for being part of this day. The couple has closed photo
        uploads — they have everything they need.
      </p>
    </div>
  );
}
