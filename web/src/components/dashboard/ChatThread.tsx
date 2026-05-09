"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bot, Send, User } from "lucide-react";

import { sendMessage } from "@/app/dashboard/bookings/[id]/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MessageOut } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export function ChatThread({
  bookingId,
  initialMessages,
}: {
  bookingId: string;
  initialMessages: MessageOut[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  function onSubmit(fd: FormData) {
    const content = (fd.get("content") as string | null)?.trim();
    if (!content) return;
    setError(null);
    const optimistic: MessageOut = {
      id: `local-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    formRef.current?.reset();
    startTransition(async () => {
      const result = await sendMessage(bookingId, fd);
      if (result.ok) {
        setMessages((m) =>
          m.map((x) => (x.id === optimistic.id ? result.message : x)),
        );
      } else {
        setError(result.error);
        // Remove the failed optimistic message.
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      }
    });
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-border/60 bg-muted/20 p-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            <p>
              Send the first message — the agent is waiting on the supplier&apos;s
              Mac.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
          </ul>
        )}
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <form ref={formRef} action={onSubmit} className="flex items-end gap-2">
        <Textarea
          name="content"
          rows={2}
          placeholder="Message the agent…"
          required
          className="flex-1 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              const form = (e.target as HTMLTextAreaElement).form;
              form?.requestSubmit();
            }
          }}
        />
        <Button type="submit" disabled={isPending} size="lg">
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Press ⌘+Enter (Mac) or Ctrl+Enter to send.
      </p>
    </div>
  );
}

function Bubble({ message }: { message: MessageOut }) {
  const isUser = message.role === "user";
  return (
    <li className={cn("flex gap-2.5", isUser && "justify-end")}>
      {!isUser && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-prose whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm",
          isUser
            ? "bg-foreground text-background"
            : "bg-card text-foreground border border-border/60",
        )}
      >
        {message.content}
      </div>
      {isUser && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-foreground text-background">
          <User className="h-4 w-4" />
        </div>
      )}
    </li>
  );
}
