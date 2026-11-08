// SCRUM-244: Stands in for std's serve() (see import_map.json). Instead of opening a port,
// it keeps the function's handler so a test can call it directly.
export type Handler = (req: Request) => Response | Promise<Response>

export const served: { handler: Handler | null } = { handler: null }

export function serve(handler: Handler) {
  served.handler = handler
}
