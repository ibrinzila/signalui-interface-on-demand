import type { Anomaly, JsonSchema, ValidationError, WorkspaceState } from './types.js';

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function diagnostic(code: string, path: string, message: string): ValidationError {
  return { code, path, message };
}

export function validateCommandInput(schema: JsonSchema, input: unknown): ValidationError[] {
  if (!object(input)) return [diagnostic('invalid-input', '$', 'Command input must be an object.')];
  const errors: ValidationError[] = [];
  const required = new Set(schema.required ?? []);

  for (const name of required) {
    if (!Object.hasOwn(input, name)) errors.push(diagnostic('missing-required-input', name, `${name} is required.`));
  }
  if (schema.additionalProperties === false) {
    for (const name of Object.keys(input)) {
      if (!Object.hasOwn(schema.properties, name)) {
        errors.push(diagnostic('unknown-input-property', name, `${name} is not allowed.`));
      }
    }
  }

  for (const [name, property] of Object.entries(schema.properties)) {
    if (!Object.hasOwn(input, name)) continue;
    const value = input[name];
    const actual = typeof value;
    const validType = property.type === 'integer'
      ? actual === 'number' && Number.isInteger(value)
      : property.type === 'number'
        ? actual === 'number' && Number.isFinite(value as number)
        : actual === property.type;
    if (!validType) {
      errors.push(diagnostic('invalid-input-type', name, `${name} must be ${property.type}.`));
      continue;
    }
    if (property.enum && !property.enum.includes(value as never)) {
      errors.push(diagnostic('invalid-input-enum', name, `${name} must be one of the admitted values.`));
    }
    if (typeof value === 'number') {
      if (property.minimum !== undefined && value < property.minimum) {
        errors.push(diagnostic('input-below-minimum', name, `${name} must be at least ${property.minimum}.`));
      }
      if (property.maximum !== undefined && value > property.maximum) {
        errors.push(diagnostic('input-above-maximum', name, `${name} must be at most ${property.maximum}.`));
      }
    }
    if (typeof value === 'string') {
      if (property.minLength !== undefined && value.trim().length < property.minLength) {
        errors.push(diagnostic('input-too-short', name, `${name} must contain at least ${property.minLength} characters.`));
      }
      if (property.maxLength !== undefined && value.length > property.maxLength) {
        errors.push(diagnostic('input-too-long', name, `${name} must contain at most ${property.maxLength} characters.`));
      }
    }
  }
  return errors;
}

export function findAnomaly(state: WorkspaceState, anomalyId: unknown): Anomaly | undefined {
  return typeof anomalyId === 'string' ? state.anomalies.find((item) => item.id === anomalyId) : undefined;
}

export function replaceAnomaly(state: WorkspaceState, next: Anomaly): WorkspaceState {
  return {
    ...state,
    anomalies: state.anomalies.map((item) => item.id === next.id ? next : item),
  };
}
