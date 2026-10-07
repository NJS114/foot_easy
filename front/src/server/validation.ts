import * as compiled from "./validators.generated";
import routes from "./body-routes.json";
import { WorkflowError } from "../workflows/domain";
const validators = routes.map(({ route, name }) => ({
  route: new RegExp("^" + route.replace(/\{[^}]+\}/g, "[^/]+") + "$"),
  validate: compiled[name as keyof typeof compiled],
}));
// API schemas are validated and unknown properties removed before reaching the legacy dispatcher.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateCoreInput(method: string, path: string, value: unknown): any {
  const validator = validators.find((v) => v.route.test(method + " " + path));
  if (!validator) throw new WorkflowError("Route de modification inconnue.", 404);
  if (!validator.validate(value))
    throw new WorkflowError(
      "Vérifiez les champs obligatoires et leur format : " +
        validator.validate.errors
          ?.map((e) => `${e.instancePath || ""} ${e.message}`)
          .join(" ; ")
          .slice(0, 450),
    );
  return value;
}
