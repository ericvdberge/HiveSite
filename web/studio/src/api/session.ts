export type UnauthenticatedHandler = () => void

let handler: UnauthenticatedHandler = () => {}

/** Sign-in (#58) calls this once to decide what a 401 `unauthenticated` does. */
export function setUnauthenticatedHandler(next: UnauthenticatedHandler): void {
    handler = next
}

export function handleUnauthenticated(): void {
    handler()
}
