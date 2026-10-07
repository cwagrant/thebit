import { deleteSecret, getSecret, hasSecret, setSecret } from "./secrets.js";

export type SecretOwner = "controller" | "listener";

export type SecretChanges = { [key: string]: string | null | undefined };

function secretKey(owner: SecretOwner, id: number, field: string): string {
  return `${owner}:${id}:${field}`;
}

function secretFields(fields: SettingField[]): SettingField[] {
  return fields.filter((field) => field.secret);
}

export function splitSecrets(fields: SettingField[], options: any): { options: any, secrets: SecretChanges } {
  const secrets: SecretChanges = {};

  if (!options || typeof options !== "object" || Array.isArray(options))
    return { options, secrets };

  const rest = { ...options };

  for (const field of secretFields(fields)) {
    if (field.key in rest) {
      if (typeof rest[field.key] === "string")
        secrets[field.key] = rest[field.key];

      delete rest[field.key];
    }
  }

  return { options: rest, secrets };
}

export function saveSecrets(owner: SecretOwner, id: number, fields: SettingField[], changes: SecretChanges): void {
  for (const field of secretFields(fields)) {
    const value = changes[field.key];

    if (value === null)
      deleteSecret(secretKey(owner, id, field.key));
    else if (typeof value === "string" && value !== "")
      setSecret(secretKey(owner, id, field.key), value);
  }
}

export function loadSecrets(owner: SecretOwner, id: number, fields: SettingField[]): { [key: string]: string } {
  const secrets: { [key: string]: string } = {};

  for (const field of secretFields(fields)) {
    const value = getSecret(secretKey(owner, id, field.key));

    if (value !== undefined)
      secrets[field.key] = value;
  }

  return secrets;
}

export function secretsPresent(owner: SecretOwner, id: number, fields: SettingField[]): { [key: string]: boolean } {
  return Object.fromEntries(
    secretFields(fields).map((field) => [field.key, hasSecret(secretKey(owner, id, field.key))])
  );
}

export function toWebSocketUrl(value: string): string {
  return value.trim().replace(/^http(s?):\/\//i, "ws$1://");
}

export function normalizeFields(fields: SettingField[], options: any): void {
  if (!options || typeof options !== "object")
    return;

  for (const field of fields) {
    if (field.type === "ws-url" && typeof options[field.key] === "string")
      options[field.key] = toWebSocketUrl(options[field.key]);
  }
}

export function validateFields(
  fields: SettingField[],
  options: any,
  secrets: SecretChanges,
  { enforceRequired = false, secretsAlreadySet = {} as { [key: string]: boolean } } = {}
): string | undefined {
  for (const field of fields) {
    const value = field.secret ? secrets[field.key] : options?.[field.key];
    const missing = value === undefined || value === null || value === "";

    if (missing) {
      const kept = field.secret && value !== null && secretsAlreadySet[field.key];

      if (enforceRequired && field.required && !kept)
        return `'${field.label}' is required.`;

      continue;
    }

    if (field.type === "json")
      continue;

    if (field.type === "scenes") {
      if (!Array.isArray(value))
        return `'${field.label}' must be a list.`;

      if (value.some((scene: any) => typeof scene?.name !== "string" || scene.name.trim() === ""))
        return `Every entry in '${field.label}' needs a name.`;

      const isSizeOrUnset = (n: unknown) => n === undefined || n === null || (typeof n === "number" && Number.isFinite(n) && n > 0);

      if (value.some((scene: any) => !isSizeOrUnset(scene.defaultWidth) || !isSizeOrUnset(scene.defaultHeight)))
        return `The default width and height in '${field.label}' must be numbers above zero.`;

      continue;
    }

    if (typeof value !== "string" && !(field.type === "text" && typeof value === "number"))
      return `'${field.label}' must be text.`;

    if (field.type === "ws-url") {
      let protocol: string | undefined;

      try {
        protocol = new URL(value as string).protocol;
      } catch { }

      if (protocol !== "ws:" && protocol !== "wss:")
        return `'${field.label}' must be a WebSocket URL starting with ws:// or wss://.`;
    }
  }

  return undefined;
}
