import { NextResponse } from "next/server";
import { publicError } from "./errors";

type RouteAction<T> = () => Promise<T>;

export function route<T>(action: RouteAction<T>, successStatus = 200) {
  return action()
    .then((data) =>
      data === undefined
        ? new NextResponse(null, { status: successStatus })
        : NextResponse.json(data, { status: successStatus }),
    )
    .catch((error: unknown) => {
      const { status, message } = publicError(error);
      if (status >= 500) console.error(error);
      return NextResponse.json({ message }, { status });
    });
}

export function positiveInteger(value: string | null, fallback: number, maximum?: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return maximum ? Math.min(parsed, maximum) : parsed;
}
