"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="app-loading">
      <div>
        <h1>Something went wrong</h1>
        <p>Please retry. Your saved data is safe.</p>
        <button className="primary-button" onClick={reset}>
          Retry
        </button>
      </div>
    </main>
  );
}
