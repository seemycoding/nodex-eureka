import 'reflect-metadata';

const METHOD_META_KEY = Symbol('METHOD_META');

function createMethodDecorator(method: string) {
  return function (path: string): MethodDecorator {
    return function (target, propertyKey) {
      Reflect.defineMetadata(METHOD_META_KEY, {
        method,
        path,
        eurekaServerUrl: 'http://localhost:8761' // default; can be enhanced
      }, target, propertyKey);
    };
  };
}

export const GET = createMethodDecorator('GET');
export const POST = createMethodDecorator('POST');
export const PUT = createMethodDecorator('PUT');
export const DELETE = createMethodDecorator('DELETE');
export { METHOD_META_KEY };
