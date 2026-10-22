/** Why a platform said no, in words the app can show; `code` says what to do next. */
export class PlatformError extends Error {
  constructor(
    message: string,
    readonly code:
      | "login"
      | "challenge"
      | "locked"
      | "feedback"
      | "wait"
      | "private"
      | "not_found"
      | "invalid"
      | "platform"
      | "bridge"
      | "auth",
  ) {
    super(message)
  }
  /** The platform is pushing back on this account: stop acting for today. */
  get backOff() {
    return ["feedback", "wait", "challenge", "locked"].includes(this.code)
  }
  /** The session is gone: the person has to connect again. */
  get expired() {
    return this.code === "login" || this.code === "challenge" || this.code === "locked"
  }
}
