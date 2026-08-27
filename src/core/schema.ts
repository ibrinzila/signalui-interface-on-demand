import type {
  CapabilityContract,
  CapabilityContractDocument,
  CapabilityEffect,
  Role,
  SurfaceRecipeContract,
  SurfaceRecipeDocument,
  ValidationError,
  ValidationResult,
} from './types.js';

const roles = new Set<Role>(['operator', 'manager', 'auditor']);
const effects = new Set<CapabilityEffect>(['read', 'ui', 'write', 'consequential-write']);

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function error(code: string, path: string, message: string): ValidationError {
  return { code, path, message };
}

function validateCapability(value: unknown, index: number, errors: ValidationError[]): void {
  const path = `capabilities[${index}]`;
  if (!object(value)) {
    errors.push(error('invalid-capability', path, 'Capability must be an object.'));
    return;
  }

  if (!nonEmpty(value.id)) errors.push(error('missing-capability-id', `${path}.id`, 'Capability ID is required.'));
  if (!nonEmpty(value.title)) errors.push(error('missing-capability-title', `${path}.title`, 'Capability title is required.'));
  if (!nonEmpty(value.description) || value.description.trim().length < 18) {
    errors.push(error('weak-capability-description', `${path}.description`, 'Description must explain the operation and when to use it.'));
  }
  if (!effects.has(value.effect as CapabilityEffect)) {
    errors.push(error('invalid-capability-effect', `${path}.effect`, 'Effect must be read, ui, write, or consequential-write.'));
  }

  const declaredRoles = Array.isArray(value.roles) ? value.roles : [];
  if (declaredRoles.some((role) => !roles.has(role as Role))) {
    errors.push(error('invalid-capability-role', `${path}.roles`, 'Every role must be operator, manager, or auditor.'));
  }
  if ((value.effect === 'write' || value.effect === 'consequential-write') && declaredRoles.length === 0) {
    errors.push(error('write-capability-without-role', `${path}.roles`, 'Write capabilities require at least one admitted role.'));
  }

  if (!object(value.inputSchema) || value.inputSchema.type !== 'object' || !object(value.inputSchema.properties)) {
    errors.push(error('invalid-input-schema', `${path}.inputSchema`, 'Input schema must be an object JSON Schema with properties.'));
  }
  if (!object(value.annotations) || typeof value.annotations.readOnlyHint !== 'boolean' || typeof value.annotations.untrustedContentHint !== 'boolean') {
    errors.push(error('invalid-annotations', `${path}.annotations`, 'WebMCP annotations must declare readOnlyHint and untrustedContentHint.'));
  }
  if (typeof value.requiresConfirmation !== 'boolean') {
    errors.push(error('missing-confirmation-policy', `${path}.requiresConfirmation`, 'Confirmation policy must be explicit.'));
  }
  if (!Array.isArray(value.availableWhen)) {
    errors.push(error('missing-availability-policy', `${path}.availableWhen`, 'Capability availability rules must be explicit.'));
  }
  if (value.effect === 'read' && object(value.annotations) && value.annotations.readOnlyHint !== true) {
    errors.push(error('read-tool-missing-hint', `${path}.annotations.readOnlyHint`, 'Read capabilities must set readOnlyHint to true.'));
  }
  if (value.effect === 'consequential-write' && value.requiresConfirmation !== true) {
    errors.push(error('consequential-write-without-confirmation', `${path}.requiresConfirmation`, 'Consequential writes require confirmation.'));
  }
}

export function validateCapabilityContracts(value: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  if (!object(value)) return { valid: false, errors: [error('invalid-document', '$', 'Contract document must be an object.')] };
  if (!nonEmpty(value.version)) errors.push(error('missing-version', 'version', 'Document version is required.'));
  if (!Array.isArray(value.capabilities)) {
    errors.push(error('missing-capabilities', 'capabilities', 'Capabilities must be an array.'));
    return { valid: false, errors };
  }

  value.capabilities.forEach((capability, index) => validateCapability(capability, index, errors));
  const ids = value.capabilities
    .filter(object)
    .map((capability) => capability.id)
    .filter(nonEmpty);
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(error('duplicate-capability-id', 'capabilities', `Duplicate capability ID: ${id}.`));
    seen.add(id);
  }
  return { valid: errors.length === 0, errors };
}

function validateRecipe(value: unknown, index: number, errors: ValidationError[]): void {
  const path = `recipes[${index}]`;
  if (!object(value)) {
    errors.push(error('invalid-recipe', path, 'Recipe must be an object.'));
    return;
  }
  if (!nonEmpty(value.id)) errors.push(error('missing-recipe-id', `${path}.id`, 'Recipe ID is required.'));
  if (!nonEmpty(value.title)) errors.push(error('missing-recipe-title', `${path}.title`, 'Recipe title is required.'));
  if (!nonEmpty(value.description)) errors.push(error('missing-recipe-description', `${path}.description`, 'Recipe description is required.'));
  const regions = Array.isArray(value.regions) ? value.regions.filter(nonEmpty) : [];
  if (!regions.includes('adaptation-explanation')) {
    errors.push(error('missing-explanation-region', `${path}.regions`, 'Every recipe must explain its adaptation.'));
  }
  if (!regions.includes('reversal-controls')) {
    errors.push(error('missing-reversal-region', `${path}.regions`, 'Every recipe must expose reversal controls.'));
  }
  if (typeof value.maxPrimaryItems !== 'number' || !Number.isInteger(value.maxPrimaryItems) || value.maxPrimaryItems < 1) {
    errors.push(error('invalid-primary-item-budget', `${path}.maxPrimaryItems`, 'Recipe must declare a positive integer item budget.'));
  }
}

export function validateSurfaceRecipes(value: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  if (!object(value)) return { valid: false, errors: [error('invalid-document', '$', 'Recipe document must be an object.')] };
  if (!nonEmpty(value.version)) errors.push(error('missing-version', 'version', 'Document version is required.'));
  if (!Array.isArray(value.recipes)) {
    errors.push(error('missing-recipes', 'recipes', 'Recipes must be an array.'));
    return { valid: false, errors };
  }
  value.recipes.forEach((recipe, index) => validateRecipe(recipe, index, errors));
  const ids = value.recipes.filter(object).map((recipe) => recipe.id).filter(nonEmpty);
  if (new Set(ids).size !== ids.length) errors.push(error('duplicate-recipe-id', 'recipes', 'Recipe IDs must be unique.'));
  return { valid: errors.length === 0, errors };
}

export function asCapabilityContractDocument(value: unknown): CapabilityContractDocument {
  const result = validateCapabilityContracts(value);
  if (!result.valid) throw new Error(result.errors.map((item) => `${item.path}: ${item.message}`).join('\n'));
  return value as unknown as CapabilityContractDocument;
}

export function asSurfaceRecipeDocument(value: unknown): SurfaceRecipeDocument {
  const result = validateSurfaceRecipes(value);
  if (!result.valid) throw new Error(result.errors.map((item) => `${item.path}: ${item.message}`).join('\n'));
  return value as unknown as SurfaceRecipeDocument;
}

export function capabilityById(document: CapabilityContractDocument, id: string): CapabilityContract | undefined {
  return document.capabilities.find((capability) => capability.id === id);
}

export function recipeById(document: SurfaceRecipeDocument, id: string): SurfaceRecipeContract | undefined {
  return document.recipes.find((recipe) => recipe.id === id);
}
