"use client";

import type { Metadata } from "next";
import type { FormEvent } from "react";
import { useState } from "react";

export default function ContactPage() {
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement)
        .value,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setStatus("sent");
        form.reset();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-xl px-6">
        <div className="animate-in">
          <p className="text-xs tracking-widest text-accent/70 uppercase">
            Get in touch
          </p>
          <h1 className="mt-6 text-5xl text-foreground">
            Contact
          </h1>
          <p className="mt-4 text-muted">
            Questions, feedback, or just want to say hello? Send a message.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-12 space-y-6 animate-in delay-2"
        >
          <div>
            <label
              htmlFor="name"
              className="block text-xs font-bold text-muted/70 uppercase tracking-wider"
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-3 block w-full rounded-xl border border-card-border bg-card-bg px-5 py-3.5 text-sm text-foreground placeholder:text-muted/30 focus:border-accent focus:outline-none transition-all"
              placeholder="Your name"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-bold text-muted/70 uppercase tracking-wider"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-3 block w-full rounded-xl border border-card-border bg-card-bg px-5 py-3.5 text-sm text-foreground placeholder:text-muted/30 focus:border-accent focus:outline-none transition-all"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="message"
              className="block text-xs font-bold text-muted/70 uppercase tracking-wider"
            >
              Message
            </label>
            <textarea
              id="message"
              name="message"
              rows={6}
              required
              className="mt-3 block w-full rounded-xl border border-card-border bg-card-bg px-5 py-3.5 text-sm text-foreground placeholder:text-muted/30 focus:border-accent focus:outline-none transition-all resize-none"
              placeholder="What's on your mind?"
            />
          </div>

          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-xl bg-accent px-6 py-3.5 text-sm font-bold text-black transition-all hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/20 disabled:opacity-50 disabled:hover:shadow-none"
          >
            {status === "sending" ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Sending...
              </span>
            ) : (
              "Send Message"
            )}
          </button>

          {status === "sent" && (
            <div className="animate-in rounded-xl border border-green-500/20 bg-green-500/5 p-4">
              <p className="text-sm text-green-400 font-mono">
                Message sent! I&apos;ll get back to you soon.
              </p>
            </div>
          )}
          {status === "error" && (
            <div className="animate-in rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm text-red-400 font-mono">
                Something went wrong. Please try again.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
