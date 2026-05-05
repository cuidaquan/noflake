const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";

export type CreateEventInput = {
  title: string;
  hostWallet: string;
  venue: string;
  startTime: string;
  depositAmount: number;
  seatCount: number;
  cutoffTime: string;
  settlementMode: "STRICT" | "PARTY" | "SPONSOR";
};

export async function createEvent(input: CreateEventInput) {
  const response = await fetch(`${API_BASE_URL}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`Failed to create event: ${response.status}`);
  }

  return response.json();
}
