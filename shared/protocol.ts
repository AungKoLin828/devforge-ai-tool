export type AgentEventType =
  | "agent.connected"
  | "agent.disconnected"
  | "file.changed"
  | "file.created"
  | "file.deleted"
  | "build.started"
  | "build.output"
  | "build.finished"
  | "test.started"
  | "test.output"
  | "test.finished"
  | "git.changed"
  | "job.started"
  | "job.finished";
export type AgentMessage = {
  id: string;
  type: "hello" | "event" | "request" | "response";
  action?: string;
  payload?: unknown;
  requestId?: string;
};
export type AgentCapabilities = {
  node?: boolean;
  java?: boolean;
  maven?: boolean;
  gradle?: boolean;
  python?: boolean;
  docker?: boolean;
  git?: boolean;
};
