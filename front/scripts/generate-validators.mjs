import Ajv from "ajv";
import addFormats from "ajv-formats";
import standalone from "ajv/dist/standalone/index.js";
import { readFile, writeFile } from "node:fs/promises";
const schema = JSON.parse(await readFile("src/server/body-schemas.json", "utf8"));
const ajv = new Ajv({
  strict: false,
  allErrors: true,
  removeAdditional: true,
  code: { source: true, esm: true },
});
addFormats(ajv);
const names = {};
const routes = [];
Object.entries(schema.paths).forEach(([route, body], index) => {
  const name = `bodyValidator${index}`;
  ajv.addSchema({ ...body, components: { schemas: schema.schemas } }, name);
  names[name] = name;
  routes.push({ route, name });
});
await writeFile("src/server/validators.generated.js", standalone(ajv, names));
await writeFile(
  "src/server/validators.generated.d.ts",
  "type Validator=((data:unknown)=>boolean)&{errors?:{message?:string;instancePath?:string}[]|null};\n" +
    Object.keys(names)
      .map((n) => `export const ${n}:Validator;`)
      .join("\n"),
);
await writeFile("src/server/body-routes.json", JSON.stringify(routes));
