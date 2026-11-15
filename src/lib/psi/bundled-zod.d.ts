// La versión de Zod incluida en Next 16 no publica declaraciones en esta ruta.
declare module "next/dist/compiled/zod/index.cjs" {
  interface Schema<T> {
    parse(value: unknown): T;
    nullish(): Schema<T | null | undefined>;
  }

  interface StringSchema extends Schema<string> {
    min(length: number): StringSchema;
    regex(pattern: RegExp): StringSchema;
  }

  interface NumberSchema extends Schema<number> {
    int(): NumberSchema;
    nonnegative(): NumberSchema;
  }

  interface ObjectSchema<T> extends Schema<T> {
    passthrough(): ObjectSchema<T & Record<string, unknown>>;
  }

  const bundled: {
    string(): StringSchema;
    number(): NumberSchema;
    boolean(): Schema<boolean>;
    array<T>(item: Schema<T>): Schema<T[]>;
    object<T extends Record<string, Schema<unknown>>>(shape: T): ObjectSchema<{ [K in keyof T]: ReturnType<T[K]["parse"]> }>;
  };
  export default bundled;
}
