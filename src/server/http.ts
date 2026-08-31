import { NextResponse } from "next/server";
import { ZodError } from "zod";

type RouteAction<T> = () => Promise<T>;

export function route<T>(action: RouteAction<T>, successStatus = 200) {
  return action()
    .then((data) =>
      data === undefined
        ? new NextResponse(null, { status: successStatus })
        : NextResponse.json(data, { status: successStatus }),
    )
    .catch((error: unknown) => {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { message: error.issues[0]?.message ?? "Invalid information", issues: error.issues },
          { status: 400 },
        );
      }
      const status =
        typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
      const rawMessage = error instanceof Error ? error.message : "Unexpected server error";
      const message =
        status >= 500 ? "Unable to complete this action. Please try again." : rawMessage;
      if (status >= 500) console.error(error);
      return NextResponse.json({ message }, { status });
    });
}

export function positiveInteger(value: string | null, fallback: number, maximum?: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return maximum ? Math.min(parsed, maximum) : parsed;
}
