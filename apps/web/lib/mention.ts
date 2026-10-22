/** "@najimi …" or a line that starts with "Najimi": how someone calls the agent in a circle or DM. */
export const MENTION = /(^|\s)@najimi\b|^\s*najimi\b/i

export type RoomKind = "agent" | "circle" | "dm"

/** Whether a message gets an answer: always in your own chat with Najimi, else only when called. */
export const callsNajimi = (kind: RoomKind, text: string) => kind === "agent" || MENTION.test(text)
