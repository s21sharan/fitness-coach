"use client";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] rounded-2xl rounded-br-sm bg-black px-4 py-2.5 text-sm text-white">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 items-start">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500">
        <span className="text-sm font-bold text-white">C</span>
      </div>
      <div className="max-w-[75%] rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-gray-700">
        <div dangerouslySetInnerHTML={{ __html: formatContent(content) }} />
      </div>
    </div>
  );
}

function formatContent(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n- /g, "<br>• ")
    .replace(/\n/g, "<br>");
}
